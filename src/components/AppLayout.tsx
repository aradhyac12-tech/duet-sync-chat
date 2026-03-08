import { Outlet, useLocation, useNavigate } from "react-router-dom";
import BottomNav from "./BottomNav";
import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";

const TAB_ORDER = ["/chat", "/gallery", "/calls", "/playlist", "/us"];
const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY = 300;

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [direction, setDirection] = useState(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isSwipingRef = useRef(false);

  const currentIndex = TAB_ORDER.indexOf(location.pathname);

  const handlePanEnd = useCallback(
    (_: any, info: PanInfo) => {
      if (currentIndex === -1) return;

      // Only swipe if horizontal movement is significantly more than vertical
      if (Math.abs(info.offset.y) > Math.abs(info.offset.x) * 0.8) return;

      const swipedLeft = info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -SWIPE_VELOCITY;
      const swipedRight = info.offset.x > SWIPE_THRESHOLD || info.velocity.x > SWIPE_VELOCITY;

      if (swipedLeft && currentIndex < TAB_ORDER.length - 1) {
        setDirection(1);
        navigate(TAB_ORDER[currentIndex + 1]);
      } else if (swipedRight && currentIndex > 0) {
        setDirection(-1);
        navigate(TAB_ORDER[currentIndex - 1]);
      }
    },
    [currentIndex, navigate]
  );

  // Determine if swiping should be enabled (not on map which uses touch for panning)
  const isSwipeEnabled = location.pathname !== "/map";

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? "30%" : "-30%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? "-30%" : "30%",
      opacity: 0,
    }),
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.main
          key={location.pathname}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
          className="pb-20"
          {...(isSwipeEnabled
            ? {
                onPanEnd: handlePanEnd,
              }
            : {})}
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
