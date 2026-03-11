import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Eye } from "lucide-react";
import { usePeekDetection } from "@/hooks/usePeekDetection";
import { useTheme } from "@/contexts/ThemeContext";
import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";

const PeekGuard = () => {
  const { appSettings } = useTheme();
  const { isPeeking, isActive, facesDetected } = usePeekDetection(
    appSettings.peekGuard ?? false
  );
  const [dismissed, setDismissed] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  // Enable native privacy screen on Capacitor when peek guard is on
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

  // When peeking detected, show overlay
  useEffect(() => {
    if (isPeeking) {
      setDismissed(false);
      setShowAlert(true);
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
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black"
        >
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative z-10 text-center space-y-5 px-8 max-w-sm"
          >
            {/* Icon */}
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="mx-auto h-20 w-20 rounded-2xl bg-red-500/15 flex items-center justify-center"
            >
              <ShieldAlert className="h-10 w-10 text-red-500" />
            </motion.div>

            {/* Text */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">
                Someone is watching
              </h2>
              <p className="text-sm text-white/50 leading-relaxed">
                {facesDetected} faces detected. Screen has been locked for your privacy.
              </p>
            </div>

            {/* Indicator */}
            <div className="flex items-center justify-center gap-2 text-xs text-white/30">
              <Eye className="h-3.5 w-3.5" />
              <span>{facesDetected} face{facesDetected !== 1 ? "s" : ""} detected</span>
            </div>

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="mt-4 px-6 py-2.5 rounded-xl bg-white text-black text-sm font-medium transition-transform active:scale-95"
            >
              It's just me — dismiss
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PeekGuard;
