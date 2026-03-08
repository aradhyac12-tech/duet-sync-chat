import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const AppLockScreen = () => {
  const { setIsAppLocked } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center"
      onClick={() => setIsAppLocked(false)}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="text-center space-y-4"
      >
        <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center mx-auto">
          <Lock className="h-8 w-8 text-foreground" />
        </div>
        <h2 className="text-xl font-serif">DuoSpace Locked</h2>
        <p className="text-sm text-muted-foreground">Tap anywhere to unlock</p>
      </motion.div>
    </motion.div>
  );
};

export default AppLockScreen;
