import { Outlet } from "react-router-dom";
import SurpriseOverlay from "@/components/SurpriseOverlay";
import MoodDetector from "@/components/MoodDetector";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <main>
        <Outlet />
      </main>
      <SurpriseOverlay />
      <MoodDetector />
    </div>
  );
};

export default AppLayout;
