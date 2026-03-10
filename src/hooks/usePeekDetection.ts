import { useCallback, useEffect, useRef, useState } from "react";

interface UsePeekDetectionReturn {
  isPeeking: boolean;
  isActive: boolean;
  start: () => Promise<void>;
  stop: () => void;
  error: string | null;
  facesDetected: number;
}

export const usePeekDetection = (enabled: boolean): UsePeekDetectionReturn => {
  const [isPeeking, setIsPeeking] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facesDetected, setFacesDetected] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (peekTimeoutRef.current) {
      clearTimeout(peekTimeoutRef.current);
      peekTimeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.remove();
      videoRef.current = null;
    }
    if (canvasRef.current) {
      canvasRef.current.remove();
      canvasRef.current = null;
    }
    detectorRef.current = null;
    setIsActive(false);
  }, []);

  const detectFaces = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    if (video.readyState < 2) return; // not ready

    try {
      // Use FaceDetector API (Chromium-based browsers)
      const faces = await detectorRef.current.detect(video);
      const count = faces.length;
      setFacesDetected(count);

      if (count > 1) {
        // Multiple faces detected — someone is peeking
        if (!peekTimeoutRef.current) {
          // Require sustained detection (1.5s) to avoid false positives
          peekTimeoutRef.current = setTimeout(() => {
            setIsPeeking(true);
          }, 1500);
        }
      } else {
        // Clear pending peek detection
        if (peekTimeoutRef.current) {
          clearTimeout(peekTimeoutRef.current);
          peekTimeoutRef.current = null;
        }
      }
    } catch {
      // FaceDetector might fail on some frames, ignore
    }
  }, []);

  const start = useCallback(async () => {
    if (isActive) return;
    setError(null);

    // Check if FaceDetector API is available
    if (!("FaceDetector" in window)) {
      // Fallback: use canvas-based simple brightness detection won't work well
      // For now, set error for unsupported browsers
      setError("Face detection not supported in this browser. Works best on Android/Chrome.");
      return;
    }

    try {
      // Create hidden video element for camera
      const video = document.createElement("video");
      video.setAttribute("playsinline", "");
      video.setAttribute("autoplay", "");
      video.style.position = "fixed";
      video.style.top = "-9999px";
      video.style.left = "-9999px";
      video.style.width = "1px";
      video.style.height = "1px";
      video.style.opacity = "0";
      document.body.appendChild(video);
      videoRef.current = video;

      const canvas = document.createElement("canvas");
      canvas.style.display = "none";
      document.body.appendChild(canvas);
      canvasRef.current = canvas;

      // Get camera stream — low resolution to save battery
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 5, max: 10 },
        },
        audio: false,
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();

      // Initialize FaceDetector
      // @ts-ignore - FaceDetector is not in TS types
      detectorRef.current = new window.FaceDetector({
        fastMode: true,
        maxDetectedFaces: 5,
      });

      // Run detection every 800ms to save battery
      intervalRef.current = setInterval(detectFaces, 800);
      setIsActive(true);
    } catch (err: any) {
      console.error("Peek detection error:", err);
      setError(err.message || "Could not start peek detection");
      cleanup();
    }
  }, [isActive, detectFaces, cleanup]);

  const stop = useCallback(() => {
    cleanup();
    setIsPeeking(false);
    setFacesDetected(0);
    setError(null);
  }, [cleanup]);

  // Auto-start/stop based on enabled flag
  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }
    return () => cleanup();
  }, [enabled]);

  // Pause detection when tab is hidden to save battery
  useEffect(() => {
    if (!enabled) return;
    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (isActive && !intervalRef.current) {
        intervalRef.current = setInterval(detectFaces, 800);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled, isActive, detectFaces]);

  return { isPeeking, isActive, start, stop, error, facesDetected };
};
