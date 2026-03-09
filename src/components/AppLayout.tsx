import { Outlet, useLocation, useNavigate } from "react-router-dom";
import BottomNav from "./BottomNav";
import { useRef, useCallback } from "react";

const TAB_ORDER = ["/chat", "/gallery", "/calls", "/map", "/playlist", "/us"];
const SWIPE_THRESHOLD = 60;

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isSwipingRef = useRef(false);

  const currentIndex = TAB_ORDER.indexOf(location.pathname);
  const isSwipeEnabled = location.pathname !== "/map";

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isSwipeEnabled) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    isSwipingRef.current = false;
  }, [isSwipeEnabled]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isSwipeEnabled || !touchStartRef.current || currentIndex === -1) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;

    // Only horizontal swipes, must be fast enough
    if (Math.abs(dy) > Math.abs(dx) * 0.7 || dt > 500) {
      touchStartRef.current = null;
      return;
    }

    if (dx < -SWIPE_THRESHOLD && currentIndex < TAB_ORDER.length - 1) {
      navigate(TAB_ORDER[currentIndex + 1]);
    } else if (dx > SWIPE_THRESHOLD && currentIndex > 0) {
      navigate(TAB_ORDER[currentIndex - 1]);
    }

    touchStartRef.current = null;
  }, [currentIndex, navigate, isSwipeEnabled]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <main
        className="pb-20"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
