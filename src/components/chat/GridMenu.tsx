import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Image, Phone, MapPin, Music, Heart, Settings, X, BookOpen } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

const items = [
  { path: "/gallery", icon: Image, label: "Gallery" },
  { path: "/calls", icon: Phone, label: "Calls" },
  { path: "/map", icon: MapPin, label: "Map" },
  { path: "/playlist", icon: Music, label: "Music" },
  { path: "/shayari", icon: BookOpen, label: "Shayari" },
  { path: "/us", icon: Heart, label: "Us" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

interface GridMenuProps {
  onClose: () => void;
}

const GridMenu = ({ onClose }: GridMenuProps) => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      className="fixed inset-0 z-50"
      onClick={onClose}
    >
      <div className="absolute bottom-[4.25rem] right-3 flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
        <motion.button
          initial={{ opacity: 0, x: 16, scale: 0.92 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 16, scale: 0.92 }}
          transition={{ duration: 0.14 }}
          onClick={onClose}
          className="h-9 w-9 rounded-full bg-card border border-border/50 shadow-lg flex items-center justify-center"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </motion.button>

        <div className="flex flex-col items-end gap-2">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.path}
                initial={{ opacity: 0, x: 24, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.92 }}
                transition={{ delay: i * 0.03, duration: 0.16 }}
                onClick={() => { hapticLight(); navigate(item.path); onClose(); }}
                className="flex items-center gap-3 rounded-full bg-card border border-border/50 shadow-lg px-3 py-2 min-w-[140px] active:scale-95 transition-transform"
              >
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <span className="text-xs font-medium text-foreground">{item.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

// Animated Hub Button with clockwise/anticlockwise rotation
export const HubButton = ({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) => {
  return (
    <motion.button
      onClick={() => { hapticLight(); onClick(); }}
      animate={{ rotate: isOpen ? 135 : 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <motion.div
        className="relative h-4 w-4"
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        {/* 4-dot grid icon that morphs to X */}
        <motion.span
          className="absolute top-0 left-0 h-1.5 w-1.5 rounded-full bg-current"
          animate={isOpen ? { x: 3, y: 3 } : { x: 0, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
        <motion.span
          className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-current"
          animate={isOpen ? { x: -3, y: 3 } : { x: 0, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
        <motion.span
          className="absolute bottom-0 left-0 h-1.5 w-1.5 rounded-full bg-current"
          animate={isOpen ? { x: 3, y: -3 } : { x: 0, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
        <motion.span
          className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-current"
          animate={isOpen ? { x: -3, y: -3 } : { x: 0, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
      </motion.div>
    </motion.button>
  );
};

export default GridMenu;
