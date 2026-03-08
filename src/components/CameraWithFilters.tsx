import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, RotateCcw, Send, Download, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface FilterDef {
  name: string;
  emoji: string;
  css: string;
}

const FILTERS: FilterDef[] = [
  { name: "Normal", emoji: "📷", css: "none" },
  { name: "Warm", emoji: "🌅", css: "sepia(0.3) saturate(1.4) brightness(1.1)" },
  { name: "Cool", emoji: "❄️", css: "saturate(0.8) brightness(1.1) hue-rotate(20deg)" },
  { name: "Vintage", emoji: "📻", css: "sepia(0.5) contrast(1.1) brightness(0.9)" },
  { name: "B&W", emoji: "🖤", css: "grayscale(1) contrast(1.2)" },
  { name: "Pop", emoji: "🎨", css: "saturate(1.8) contrast(1.2) brightness(1.05)" },
  { name: "Dreamy", emoji: "💫", css: "brightness(1.15) contrast(0.9) saturate(1.3) blur(0.5px)" },
  { name: "Sunset", emoji: "🌇", css: "sepia(0.2) saturate(1.5) hue-rotate(-15deg) brightness(1.1)" },
  { name: "Noir", emoji: "🕶️", css: "grayscale(0.8) contrast(1.4) brightness(0.85)" },
  { name: "Glow", emoji: "✨", css: "brightness(1.2) saturate(1.3) contrast(0.95)" },
  { name: "Fade", emoji: "🌫️", css: "contrast(0.85) brightness(1.1) saturate(0.7)" },
  { name: "Lomo", emoji: "🎞️", css: "saturate(1.5) contrast(1.3) brightness(0.9) sepia(0.1)" },
  { name: "Berry", emoji: "🫐", css: "hue-rotate(330deg) saturate(1.4) brightness(1.05)" },
  { name: "Fresh", emoji: "🌿", css: "hue-rotate(60deg) saturate(1.2) brightness(1.1)" },
  { name: "Golden", emoji: "🌟", css: "sepia(0.35) saturate(1.3) brightness(1.15) hue-rotate(-10deg)" },
  { name: "Cinema", emoji: "🎬", css: "contrast(1.2) saturate(0.9) brightness(0.95) sepia(0.15)" },
];

interface CameraWithFiltersProps {
  onClose: () => void;
  onCapture: (blob: Blob, filterName: string) => void;
}

const CameraWithFilters = ({ onClose, onCapture }: CameraWithFiltersProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [selectedFilter, setSelectedFilter] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const { toast } = useToast();

  const startCamera = useCallback(async (facing: "user" | "environment") => {
    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(s);
      setCameraError(null);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err) {
      setCameraError("Camera access denied. Please allow camera permission.");
      toast({ title: "Camera access needed", description: "Allow camera permission in your browser settings.", variant: "destructive" });
    }
  }, [stream, toast]);

  useEffect(() => {
    startCamera(facingMode);
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const flipCamera = () => {
    const newFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacing);
    startCamera(newFacing);
  };

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;

    // Apply filter
    ctx.filter = FILTERS[selectedFilter].css;
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    setCapturedImage(canvas.toDataURL("image/jpeg", 0.92));
  };

  const retake = () => setCapturedImage(null);

  const sendPhoto = () => {
    if (!capturedImage || !canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (blob) onCapture(blob, FILTERS[selectedFilter].name);
    }, "image/jpeg", 0.92);
  };

  if (cameraError) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-center space-y-4 px-8">
          <Camera className="h-12 w-12 text-white/40 mx-auto" />
          <p className="text-white text-sm">{cameraError}</p>
          <button onClick={onClose} className="bg-white/20 text-white px-6 py-2.5 rounded-xl text-sm">Close</button>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 safe-top">
        <button onClick={onClose} className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <X className="h-5 w-5 text-white" />
        </button>
        <div className="bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
          <span className="text-xs text-white font-medium">{FILTERS[selectedFilter].name}</span>
        </div>
        <button onClick={flipCamera} className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <RotateCcw className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Camera / captured view */}
      <div className="flex-1 relative overflow-hidden">
        {!capturedImage ? (
          <video ref={videoRef} autoPlay playsInline muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              filter: FILTERS[selectedFilter].css,
              transform: facingMode === "user" ? "scaleX(-1)" : "none",
            }} />
        ) : (
          <img src={capturedImage} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>

      {/* Bottom controls */}
      <div className="bg-black/80 backdrop-blur-md safe-bottom">
        {!capturedImage ? (
          <>
            {/* Filter strip */}
            <div className="flex overflow-x-auto gap-3 px-4 py-3 no-scrollbar">
              {FILTERS.map((f, i) => (
                <button key={f.name} onClick={() => setSelectedFilter(i)}
                  className={`flex flex-col items-center gap-1 shrink-0 ${selectedFilter === i ? "opacity-100" : "opacity-50"}`}>
                  <div className={`h-12 w-12 rounded-full bg-white/10 flex items-center justify-center text-lg ${selectedFilter === i ? "ring-2 ring-white" : ""}`}>
                    {f.emoji}
                  </div>
                  <span className="text-[9px] text-white">{f.name}</span>
                </button>
              ))}
            </div>

            {/* Capture button */}
            <div className="flex items-center justify-center py-4">
              <button onClick={capture}
                className="h-20 w-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform">
                <div className="h-16 w-16 rounded-full bg-white" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center gap-6 py-6">
            <button onClick={retake} className="flex flex-col items-center gap-1.5">
              <div className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center">
                <RotateCcw className="h-6 w-6 text-white" />
              </div>
              <span className="text-[10px] text-white">Retake</span>
            </button>
            <button onClick={sendPhoto} className="flex flex-col items-center gap-1.5">
              <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center">
                <Send className="h-6 w-6 text-white" />
              </div>
              <span className="text-[10px] text-white">Send</span>
            </button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </motion.div>
  );
};

export default CameraWithFilters;
