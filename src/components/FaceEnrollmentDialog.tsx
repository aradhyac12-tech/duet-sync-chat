/**
 * FaceEnrollmentDialog — owner face enrollment for Peek Guard.
 *
 * Captures 5–10 frames from the front camera, runs MediaPipe FaceLandmarker
 * on each, generates a normalized 478×3 embedding per sample, and persists
 * them to IndexedDB. Subsequent peek detections compare against this set
 * via best-of-N cosine similarity.
 *
 * UX: a live camera preview, a progress ring (filled per captured sample),
 * automatic capture every ~600ms once a single, well-sized face is in view,
 * and an explicit "Save" once the minimum (5) is reached.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, Check, X, RotateCcw, Loader2, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  detectFaces, saveOwnerProfile, clearOwnerProfile, loadOwnerProfile,
} from "@/lib/faceRecognition";
import { useToast } from "@/hooks/use-toast";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onEnrolled?: () => void;
}

const MIN_SAMPLES = 5;
const MAX_SAMPLES = 10;
const MIN_FACE_AREA = 0.05;        // require a clear, near-camera face for enrollment
const SAMPLE_INTERVAL_MS = 600;

const FaceEnrollmentDialog = ({ open, onClose, onEnrolled }: Props) => {
  const { toast } = useToast();
  const videoRef    = useRef<HTMLVideoElement | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const captureRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [samples, setSamples]   = useState<Float32Array[]>([]);
  const [status, setStatus]     = useState<"idle" | "starting" | "ready" | "saving" | "error">("idle");
  const [hint, setHint]         = useState("Position your face in the frame");
  const [existingCount, setExistingCount] = useState(0);

  // Load existing profile count on open
  useEffect(() => {
    if (!open) return;
    loadOwnerProfile().then((p) => setExistingCount(p?.count ?? 0));
  }, [open]);

  // Camera + capture loop
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("starting");
    setSamples([]);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("ready");
      } catch (err) {
        setStatus("error");
        setHint(err instanceof Error ? err.message : "Camera unavailable");
      }
    })();

    return () => {
      cancelled = true;
      if (captureRef.current) { clearInterval(captureRef.current); captureRef.current = null; }
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    };
  }, [open]);

  // Auto-capture loop
  useEffect(() => {
    if (status !== "ready" || !open) return;
    if (samples.length >= MAX_SAMPLES) return;

    captureRef.current = setInterval(async () => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      let faces;
      try { faces = await detectFaces(v); } catch { return; }

      if (faces.length === 0) {
        setHint("No face detected — center yourself");
        return;
      }
      if (faces.length > 1) {
        setHint("Only the owner should be in frame");
        return;
      }
      const f = faces[0];
      if (f.area < MIN_FACE_AREA) {
        setHint("Move closer to the camera");
        return;
      }
      // Capture
      hapticLight();
      setSamples((s) => {
        if (s.length >= MAX_SAMPLES) return s;
        const next = [...s, f.embedding];
        setHint(
          next.length < MIN_SAMPLES
            ? `Captured ${next.length}/${MIN_SAMPLES}+ — turn slightly`
            : `Captured ${next.length}/${MAX_SAMPLES} — looking good`,
        );
        return next;
      });
    }, SAMPLE_INTERVAL_MS);

    return () => {
      if (captureRef.current) { clearInterval(captureRef.current); captureRef.current = null; }
    };
  }, [status, open, samples.length]);

  const reset = useCallback(() => {
    setSamples([]);
    setHint("Position your face in the frame");
  }, []);

  const save = useCallback(async () => {
    if (samples.length < MIN_SAMPLES) {
      toast({ title: `Need at least ${MIN_SAMPLES} samples`, variant: "destructive" });
      return;
    }
    setStatus("saving");
    try {
      await saveOwnerProfile(samples);
      hapticMedium();
      toast({ title: "Owner face enrolled", description: `${samples.length} samples saved` });
      onEnrolled?.();
      onClose();
    } catch {
      toast({ title: "Failed to save profile", variant: "destructive" });
      setStatus("ready");
    }
  }, [samples, toast, onEnrolled, onClose]);

  const removeProfile = useCallback(async () => {
    await clearOwnerProfile();
    setExistingCount(0);
    setSamples([]);
    toast({ title: "Owner face removed" });
    onEnrolled?.();
  }, [toast, onEnrolled]);

  const progress = Math.min(samples.length / MIN_SAMPLES, 1);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" /> Enroll your face
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            We capture {MIN_SAMPLES}–{MAX_SAMPLES} angles to recognise only you.
            Photos never leave your device.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mx-5 aspect-square rounded-2xl overflow-hidden bg-black">
          <video
            ref={videoRef}
            playsInline muted autoPlay
            className="h-full w-full object-cover scale-x-[-1]"
          />
          {/* Progress ring */}
          <svg viewBox="0 0 100 100" className="absolute inset-0 pointer-events-none">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
            <circle
              cx="50" cy="50" r="46" fill="none" stroke="white" strokeWidth="3"
              strokeDasharray={`${progress * 289} 289`}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              style={{ transition: "stroke-dasharray 0.3s ease" }}
            />
          </svg>
          <div className="absolute bottom-2 left-0 right-0 text-center">
            <span className="inline-block px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] backdrop-blur">
              {samples.length}/{MAX_SAMPLES}
            </span>
          </div>
          {status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-xs gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Starting camera…
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white text-xs px-4 text-center">
              {hint}
            </div>
          )}
        </div>

        <p className="px-5 pt-3 text-center text-[11px] text-muted-foreground">{hint}</p>

        <div className="p-5 pt-3 flex gap-2">
          {existingCount > 0 && samples.length === 0 && (
            <Button
              variant="ghost" size="sm"
              onClick={removeProfile}
              className="text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={reset} disabled={samples.length === 0}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={samples.length < MIN_SAMPLES || status === "saving"}
            className={cn(samples.length >= MIN_SAMPLES && "bg-primary")}
          >
            {status === "saving"
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <><Check className="h-3.5 w-3.5 mr-1" /> Save</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FaceEnrollmentDialog;
