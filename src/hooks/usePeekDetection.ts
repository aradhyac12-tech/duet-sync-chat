/**
 * usePeekDetection — true owner-recognition peek guard.
 *
 * Pipeline (per detection tick, default ~600ms):
 *   1. Grab a frame from the hidden front-camera <video>.
 *   2. Run MediaPipe FaceLandmarker → list of faces with normalized embeddings.
 *   3. Filter out faces below `minFaceArea` (too far / specks).
 *   4. For each face, compute cosine similarity vs. enrolled owner embeddings
 *      (best-of-N). A face is "stranger" if best similarity < `matchThreshold`.
 *   5. Determine breach for *this frame*:
 *         • alertOnStranger        — any non-owner face visible
 *         • alertOnMultipleFaces   — total face count ≥ 2
 *         • alertOnNoFace          — zero faces (only when "stranger guard" is OK)
 *      The active alert modes are user-controlled in settings.
 *   6. Push the breach bool into a rolling buffer of `consistencyFrames`.
 *      Only when ALL frames in the buffer agree do we arm the lock timer.
 *   7. After `lockDelay`ms of continuous breach we surface `isPeeking = true`,
 *      which the PeekGuard component turns into a lock screen.
 *
 * No owner enrolled → falls back to count-based breach
 * (multi-face = breach; single face is fine).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  detectFaces, loadOwnerProfile, matchAgainstOwner,
  type OwnerProfile,
} from "@/lib/faceRecognition";

export interface PeekConfig {
  /** Cosine similarity threshold. ≥ this = owner. Default 0.7. */
  matchThreshold?: number;
  /** Min normalized face area (0..1). Below = ignored. Default 0.015 (~12%×12% of frame). */
  minFaceArea?: number;
  /** Number of consecutive frames the breach must be observed. Default 4. */
  consistencyFrames?: number;
  /** Sustained breach delay before locking (ms). Default 1500. */
  lockDelay?: number;
  /** Detection frequency in ms. Default 600. */
  checkInterval?: number;
  /** Trigger when a non-owner face is seen. Default true. */
  alertOnStranger?: boolean;
  /** Trigger when ≥ 2 faces are seen. Default true. */
  alertOnMultipleFaces?: boolean;
  /** Trigger when no face seen for the consistency window. Default false. */
  alertOnNoFace?: boolean;
}

const DEFAULTS: Required<PeekConfig> = {
  matchThreshold: 0.7,
  minFaceArea: 0.015,
  consistencyFrames: 4,
  lockDelay: 1500,
  checkInterval: 600,
  alertOnStranger: true,
  alertOnMultipleFaces: true,
  alertOnNoFace: false,
};

export interface PeekDetectionState {
  isPeeking: boolean;
  isActive: boolean;
  error: string | null;
  /** Total faces seen in the latest frame. */
  facesDetected: number;
  /** Strangers (non-owner) in the latest frame. */
  strangersDetected: number;
  /** True iff an owner profile is enrolled. */
  ownerEnrolled: boolean;
  /** Last reason that armed the lock. */
  reason: "stranger" | "multiple" | "no-face" | null;
}

export const usePeekDetection = (
  enabled: boolean,
  config: PeekConfig = {},
): PeekDetectionState => {
  const cfg = { ...DEFAULTS, ...config };
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  const [isPeeking, setIsPeeking]               = useState(false);
  const [isActive, setIsActive]                 = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [facesDetected, setFacesDetected]       = useState(0);
  const [strangersDetected, setStrangersDetected] = useState(0);
  const [ownerEnrolled, setOwnerEnrolled]       = useState(false);
  const [reason, setReason]                     = useState<PeekDetectionState["reason"]>(null);

  const videoRef    = useRef<HTMLVideoElement | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownerRef    = useRef<OwnerProfile | null>(null);
  const breachBuf   = useRef<boolean[]>([]);
  const reasonBuf   = useRef<NonNullable<PeekDetectionState["reason"]>[]>([]);

  // Load owner profile once / on enable
  useEffect(() => {
    let cancelled = false;
    loadOwnerProfile().then((p) => {
      if (cancelled) return;
      ownerRef.current = p;
      setOwnerEnrolled(!!p && p.count > 0);
    });
    return () => { cancelled = true; };
  }, [enabled]);

  const teardown = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (lockTimerRef.current) { clearTimeout(lockTimerRef.current); lockTimerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.remove(); videoRef.current = null; }
    breachBuf.current = [];
    reasonBuf.current = [];
    setIsActive(false);
  }, []);

  const tick = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    let faces;
    try {
      faces = await detectFaces(video);
    } catch {
      return;
    }
    const c = cfgRef.current;

    // Filter out tiny detections (noise / far-away passers-by)
    const significant = faces.filter((f) => f.area >= c.minFaceArea);
    setFacesDetected(significant.length);

    let strangerCount = 0;
    if (ownerRef.current) {
      for (const f of significant) {
        const sim = matchAgainstOwner(f.embedding, ownerRef.current);
        if (sim < c.matchThreshold) strangerCount++;
      }
    }
    setStrangersDetected(strangerCount);

    // Decide breach for THIS frame
    let breach = false;
    let why: NonNullable<PeekDetectionState["reason"]> | null = null;

    if (c.alertOnStranger && ownerRef.current && strangerCount > 0) {
      breach = true; why = "stranger";
    } else if (c.alertOnMultipleFaces && significant.length >= 2) {
      breach = true; why = "multiple";
    } else if (c.alertOnNoFace && significant.length === 0) {
      breach = true; why = "no-face";
    }

    // Rolling window
    breachBuf.current.push(breach);
    if (why) reasonBuf.current.push(why);
    if (breachBuf.current.length > c.consistencyFrames) breachBuf.current.shift();
    if (reasonBuf.current.length > c.consistencyFrames) reasonBuf.current.shift();

    const allBreach = breachBuf.current.length === c.consistencyFrames &&
                      breachBuf.current.every(Boolean);

    if (allBreach) {
      // Pick the most recent reason
      const r = reasonBuf.current[reasonBuf.current.length - 1] ?? "stranger";
      if (!lockTimerRef.current && !isPeeking) {
        lockTimerRef.current = setTimeout(() => {
          setReason(r);
          setIsPeeking(true);
        }, c.lockDelay);
      }
    } else {
      if (lockTimerRef.current) {
        clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
      // Auto-clear once breach has been gone for the full window.
      // The lock screen itself controls when isPeeking goes back to false.
    }
  }, [isPeeking]);

  const start = useCallback(async () => {
    if (isActive) return;
    setError(null);
    try {
      const video = document.createElement("video");
      video.setAttribute("playsinline", "");
      video.setAttribute("autoplay", "");
      video.muted = true;
      video.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
      document.body.appendChild(video);
      videoRef.current = video;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 8, max: 15 } },
        audio: false,
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();

      // Warm up the model so first detection isn't 1s slow
      try { await (await import("@/lib/faceRecognition")).getLandmarker(); } catch { /* network */ }

      intervalRef.current = setInterval(tick, cfgRef.current.checkInterval);
      setIsActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start camera");
      teardown();
    }
  }, [isActive, tick, teardown]);

  // enable/disable lifecycle
  useEffect(() => {
    if (enabled) start();
    else teardown();
    return () => teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Re-arm interval if checkInterval changes
  useEffect(() => {
    if (!isActive) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, cfg.checkInterval);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [cfg.checkInterval, isActive, tick]);

  // Pause work when tab hidden
  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (document.hidden) {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      } else if (isActive && !intervalRef.current) {
        intervalRef.current = setInterval(tick, cfgRef.current.checkInterval);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled, isActive, tick]);

  return {
    isPeeking, isActive, error,
    facesDetected, strangersDetected, ownerEnrolled, reason,
  };
};
