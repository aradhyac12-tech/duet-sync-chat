import { useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, Image, Phone, MapPin, Heart, Settings, Music } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";

const tabs = [
  { path: "/chat", icon: MessageCircle, label: "Chat" },
  { path: "/gallery", icon: Image, label: "Gallery" },
  { path: "/calls", icon: Phone, label: "Calls" },
  { path: "/map", icon: MapPin, label: "Map" },
  { path: "/us", icon: Heart, label: "Us" },
];

const HIDDEN_PAGES = ["/settings"];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  const isHidden = HIDDEN_PAGES.includes(location.pathname);

  // Scroll-based auto-hide
  useEffect(() => {
    if (isHidden) return;
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          const delta = currentY - lastScrollY.current;
          if (delta > 8 && currentY > 60) setIsVisible(false);
          else if (delta < -8) setIsVisible(true);
          if (currentY < 20) setIsVisible(true);
          lastScrollY.current = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHidden]);

  // Reset on page change
  useEffect(() => {
    setIsVisible(true);
    lastScrollY.current = 0;
  }, [location.pathname]);

  if (isHidden) return null;

  return (
    <motion.nav
      initial={{ y: 0 }}
      animate={{ y: isVisible ? 0 : 100 }}
      transition={{ type: "spring", stiffness: 400, damping: 35 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border safe-bottom"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-2xl transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-accent rounded-2xl"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className="relative z-10 h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="relative z-10 text-[10px] font-medium tracking-wide">{tab.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => navigate("/settings")}
          className="relative flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-2xl text-muted-foreground transition-colors"
        >
          <Settings className="h-5 w-5" strokeWidth={1.8} />
          <span className="text-[10px] font-medium tracking-wide">More</span>
        </button>
      </div>
    </motion.nav>
  );
};

export default BottomNav;
