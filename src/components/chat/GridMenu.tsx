import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Image, Phone, MapPin, Music, Heart, Settings, X, BookOpen } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import { useState } from "react";

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
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-2xl"
      onClick={onClose}
    >
      <div className="safe-top px-4 pt-3 flex justify-end">
        <button onClick={onClose} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <div className="px-6 pt-6" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4 px-1">Navigate</p>
        <div className="grid grid-cols-3 gap-3">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.path}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.15 }}
                onClick={() => { hapticLight(); navigate(item.path); onClose(); }}
                className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-card border border-border/30 active:scale-95 transition-transform"
              >
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                  <Icon className="h-[18px] w-[18px] text-foreground" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
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
