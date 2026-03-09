import { Outlet } from "react-router-dom";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
