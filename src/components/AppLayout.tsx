import { Outlet } from "react-router-dom";
import SurpriseOverlay from "@/components/SurpriseOverlay";
import MoodDetector from "@/components/MoodDetector";
import EmojiScreenEffect from "@/components/EmojiScreenEffect";

const AppLayout = () => {
  return (
    <div className="h-[100dvh] bg-background overflow-x-hidden flex flex-col">
      <main className="flex-1 min-h-0 flex flex-col">
        <Outlet />
      </main>
      <SurpriseOverlay />
      <MoodDetector />
      <EmojiScreenEffect />
    </div>
  );
};

export default AppLayout;
