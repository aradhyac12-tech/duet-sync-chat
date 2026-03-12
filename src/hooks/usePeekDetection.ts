import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

interface PeekConfig {
  faceThreshold: number;
  detectionDelay: number;
  checkInterval: number;
}

interface UsePeekDetectionReturn {
  isPeeking: boolean;
  isActive: boolean;
  start: () => Promise<void>;
  stop: () => void;
  error: string | null;
  facesDetected: number;
}

/**
 * Detects multiple faces using:
 * - FaceDetector API (Chrome/Android WebView)
 * - Canvas-based brightness heuristic as fallback (iOS/Safari)
 */
export const usePeekDetection = (
  enabled: boolean,
  config: PeekConfig = { faceThreshold: 2, detectionDelay: 1500, checkInterval: 800 }
): UsePeekDetectionReturn => {
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
  const configRef = useRef(config);
  const useFallbackRef = useRef(false);

  useEffect(() => {
    configRef.current = config;
  }, [config.faceThreshold, config.detectionDelay, config.checkInterval]);

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

  // Fallback detection for iOS: analyze frame variance to detect motion/extra presence
  const detectWithFallback = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Analyze skin-tone pixel regions as a proxy for face count
    let skinPixels = 0;
    const totalPixels = data.length / 4;
    
    for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Simple skin-tone detection in RGB space
      if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15 && r - b > 15) {
        skinPixels++;
      }
    }

    const skinRatio = skinPixels / (totalPixels / 4);
    // High skin ratio (>30%) suggests multiple faces close to camera
    const estimatedFaces = skinRatio > 0.4 ? 3 : skinRatio > 0.25 ? 2 : 1;
    
    setFacesDetected(estimatedFaces);
    const threshold = configRef.current.faceThreshold;

    if (estimatedFaces >= threshold) {
      if (!peekTimeoutRef.current) {
        peekTimeoutRef.current = setTimeout(() => {
          setIsPeeking(true);
        }, configRef.current.detectionDelay);
      }
    } else {
      if (peekTimeoutRef.current) {
        clearTimeout(peekTimeoutRef.current);
        peekTimeoutRef.current = null;
      }
    }
  }, []);

  const detectFaces = useCallback(async () => {
    if (useFallbackRef.current) {
      detectWithFallback();
      return;
    }

    if (!detectorRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2) return;

    try {
      const faces = await detectorRef.current.detect(video);
      const count = faces.length;
      setFacesDetected(count);
      const threshold = configRef.current.faceThreshold;

      if (count >= threshold) {
        if (!peekTimeoutRef.current) {
          peekTimeoutRef.current = setTimeout(() => {
            setIsPeeking(true);
          }, configRef.current.detectionDelay);
        }
      } else {
        if (peekTimeoutRef.current) {
          clearTimeout(peekTimeoutRef.current);
          peekTimeoutRef.current = null;
        }
      }
    } catch {
      // FaceDetector might fail on some frames
    }
  }, [detectWithFallback]);

  const start = useCallback(async () => {
    if (isActive) return;
    setError(null);

    const hasFaceDetector = "FaceDetector" in window;
    useFallbackRef.current = !hasFaceDetector;

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
      video.style.pointerEvents = "none";
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

      if (hasFaceDetector) {
        // @ts-ignore - FaceDetector is not in TS types
        detectorRef.current = new window.FaceDetector({
          fastMode: true,
          maxDetectedFaces: 5,
        });
      }

      // Run detection at configured interval
      intervalRef.current = setInterval(detectFaces, configRef.current.checkInterval);
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

  // Restart interval when checkInterval changes
  useEffect(() => {
    if (!isActive || !enabled) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(detectFaces, config.checkInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [config.checkInterval, isActive, enabled, detectFaces]);

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
        intervalRef.current = setInterval(detectFaces, configRef.current.checkInterval);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled, isActive, detectFaces]);

  return { isPeeking, isActive, start, stop, error, facesDetected };
};
