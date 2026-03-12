import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Eye } from "lucide-react";
import { usePeekDetection } from "@/hooks/usePeekDetection";
import { useTheme } from "@/contexts/ThemeContext";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { hapticHeavy } from "@/lib/haptics";

const PeekGuard = () => {
  const { appSettings } = useTheme();
  
  const peekConfig = useMemo(() => ({
    faceThreshold: appSettings.peekFaceThreshold ?? 2,
    detectionDelay: appSettings.peekDetectionDelay ?? 1500,
    checkInterval: appSettings.peekCheckInterval ?? 800,
  }), [appSettings.peekFaceThreshold, appSettings.peekDetectionDelay, appSettings.peekCheckInterval]);

  const { isPeeking, isActive, facesDetected } = usePeekDetection(
    appSettings.peekGuard ?? false,
    peekConfig
  );
  const [dismissed, setDismissed] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  // Enable native privacy screen on Capacitor
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const setupPrivacy = async () => {
      try {
        const { PrivacyScreen } = await import("@capacitor-community/privacy-screen");
        if (appSettings.peekGuard || appSettings.privacyMode) {
          await PrivacyScreen.enable();
        } else {
          await PrivacyScreen.disable();
        }
      } catch {
        // Plugin not available
      }
    };
    setupPrivacy();
  }, [appSettings.peekGuard, appSettings.privacyMode]);

  // When peeking detected, show overlay + haptic
  useEffect(() => {
    if (isPeeking) {
      setDismissed(false);
      setShowAlert(true);
      hapticHeavy();
    }
  }, [isPeeking]);

  // When no longer peeking and dismissed, hide
  useEffect(() => {
    if (!isPeeking && dismissed) {
      const t = setTimeout(() => setShowAlert(false), 300);
      return () => clearTimeout(t);
    }
  }, [isPeeking, dismissed]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!appSettings.peekGuard || !showAlert) return null;

  return (
    <AnimatePresence>
      {showAlert && !dismissed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            className="relative z-10 text-center space-y-6 px-8 max-w-xs"
          >
            {/* Pulsing shield */}
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
              className="mx-auto h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center"
            >
              <ShieldAlert className="h-8 w-8 text-red-500" />
            </motion.div>

            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-white tracking-tight">
                Privacy Alert
              </h2>
              <p className="text-xs text-white/40 leading-relaxed">
                {facesDetected} {facesDetected === 1 ? "face" : "faces"} detected — screen locked
              </p>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/20">
              <Eye className="h-3 w-3" />
              <span>Monitoring active</span>
            </div>

            <button
              onClick={handleDismiss}
              className="mt-2 px-5 py-2 rounded-xl bg-white/10 text-white text-xs font-medium transition-all active:scale-95 active:bg-white/20"
            >
              Dismiss
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PeekGuard;
