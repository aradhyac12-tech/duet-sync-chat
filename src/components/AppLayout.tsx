import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <main>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
