import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Image, Phone, MapPin, Music, Heart, Settings, X } from "lucide-react";

const items = [
  { path: "/gallery", icon: Image, label: "Gallery", color: "bg-accent text-accent-foreground" },
  { path: "/calls", icon: Phone, label: "Calls", color: "bg-primary/15 text-primary" },
  { path: "/map", icon: MapPin, label: "Map", color: "bg-accent text-accent-foreground" },
  { path: "/playlist", icon: Music, label: "Music", color: "bg-primary/15 text-primary" },
  { path: "/us", icon: Heart, label: "Us", color: "bg-accent text-accent-foreground" },
  { path: "/settings", icon: Settings, label: "Settings", color: "bg-muted text-muted-foreground" },
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
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 bg-background/90 backdrop-blur-2xl"
      onClick={onClose}
    >
      <div className="safe-top px-4 pt-3 flex justify-end">
        <button
          onClick={onClose}
          className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-6 pt-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-foreground mb-6">Quick Access</h2>
        <div className="grid grid-cols-3 gap-4">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.path}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                onClick={() => { navigate(item.path); onClose(); }}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-card border border-border/40 active:scale-95 transition-transform"
              >
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${item.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-medium text-foreground">{item.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default GridMenu;
