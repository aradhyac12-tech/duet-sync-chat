import { motion } from "framer-motion";
import { Fingerprint } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useBiometricLock } from "@/hooks/useBiometricLock";

const AppLockScreen = () => {
  const { isAppLocked, setIsAppLocked, appSettings } = useTheme();
  const { authenticate } = useBiometricLock(
    isAppLocked,
    setIsAppLocked,
    appSettings.biometricLock
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="text-center space-y-6"
      >
        <button
          onClick={authenticate}
          className="h-20 w-20 rounded-full bg-accent flex items-center justify-center mx-auto active:scale-95 transition-transform"
        >
          <Fingerprint className="h-9 w-9 text-foreground" />
        </button>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">DuoSpace Locked</h2>
          <p className="text-sm text-muted-foreground">Tap to authenticate</p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AppLockScreen;
