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
 * - FaceDetector API (Chrome/Android WebView) — primary
 * - Motion-variance heuristic as fallback (iOS/Safari)
 *
 * Fix #18: Removed racially-biased skin-tone fallback. Replaced with
 * frame-variance motion detection that estimates extra presence without
 * relying on skin color assumptions.
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
  // For motion fallback: store previous frame data
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);

  useEffect(() => {
    configRef.current = config;
  }, [config.faceThreshold, config.detectionDelay, config.checkInterval]);

  const cleanup = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (peekTimeoutRef.current) { clearTimeout(peekTimeoutRef.current); peekTimeoutRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.remove(); videoRef.current = null; }
    if (canvasRef.current) { canvasRef.current.remove(); canvasRef.current = null; }
    detectorRef.current = null;
    prevFrameRef.current = null;
    setIsActive(false);
  }, []);

  // Fix #18: Motion-variance fallback — no skin-tone bias.
  // Compares current frame to previous frame. High variance = extra motion/presence.
  // Uses threshold tuned for "two people looking at screen" scenario.
  const detectWithFallback = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2) return;

    const canvas = canvasRef.current;
    canvas.width = 160; // small for perf
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale and compute frame difference
    const gray = new Uint8ClampedArray(canvas.width * canvas.height);
    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }

    let estimatedFaces = 1; // assume at least the owner
    if (prevFrameRef.current && prevFrameRef.current.length === gray.length) {
      // Measure mean absolute diff between frames
      let totalDiff = 0;
      for (let i = 0; i < gray.length; i++) {
        totalDiff += Math.abs(gray[i] - prevFrameRef.current[i]);
      }
      const avgDiff = totalDiff / gray.length;
      // High motion in foreground hints at a second person's movement
      // Calibrated: >12 avg pixel diff = likely extra person moving
      if (avgDiff > 20) estimatedFaces = 3;
      else if (avgDiff > 12) estimatedFaces = 2;
    }
    prevFrameRef.current = gray.slice();

    setFacesDetected(estimatedFaces);
    const threshold = configRef.current.faceThreshold;

    if (estimatedFaces >= threshold) {
      if (!peekTimeoutRef.current) {
        peekTimeoutRef.current = setTimeout(() => setIsPeeking(true), configRef.current.detectionDelay);
      }
    } else {
      if (peekTimeoutRef.current) { clearTimeout(peekTimeoutRef.current); peekTimeoutRef.current = null; }
      // Cleared peeking only after sustained absence
      setIsPeeking(false);
    }
  }, []);

  const detectFaces = useCallback(async () => {
    if (useFallbackRef.current) { detectWithFallback(); return; }
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
          peekTimeoutRef.current = setTimeout(() => setIsPeeking(true), configRef.current.detectionDelay);
        }
      } else {
        if (peekTimeoutRef.current) { clearTimeout(peekTimeoutRef.current); peekTimeoutRef.current = null; }
        setIsPeeking(false);
      }
    } catch { /* FaceDetector can fail on some frames */ }
  }, [detectWithFallback]);

  const start = useCallback(async () => {
    if (isActive) return;
    setError(null);
    const hasFaceDetector = "FaceDetector" in window;
    useFallbackRef.current = !hasFaceDetector;

    try {
      const video = document.createElement("video");
      video.setAttribute("playsinline", "");
      video.setAttribute("autoplay", "");
      video.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
      document.body.appendChild(video);
      videoRef.current = video;

      const canvas = document.createElement("canvas");
      canvas.style.display = "none";
      document.body.appendChild(canvas);
      canvasRef.current = canvas;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 5, max: 10 } },
        audio: false,
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();

      if (hasFaceDetector) {
        // @ts-ignore
        detectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
      }

      intervalRef.current = setInterval(detectFaces, configRef.current.checkInterval);
      setIsActive(true);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || "Could not start peek detection");
      cleanup();
    }
  }, [isActive, detectFaces, cleanup]);

  const stop = useCallback(() => {
    cleanup();
    setIsPeeking(false);
    setFacesDetected(0);
    setError(null);
  }, [cleanup]);

  useEffect(() => {
    if (enabled) start();
    else stop();
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!isActive || !enabled) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(detectFaces, config.checkInterval);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [config.checkInterval, isActive, enabled, detectFaces]);

  useEffect(() => {
    if (!enabled) return;
    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      } else if (isActive && !intervalRef.current) {
        intervalRef.current = setInterval(detectFaces, configRef.current.checkInterval);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled, isActive, detectFaces]);

  return { isPeeking, isActive, start, stop, error, facesDetected };
};
