import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import AppLayout from "@/components/AppLayout";
import AppLockScreen from "@/components/AppLockScreen";
import Auth from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import Chat from "@/pages/Chat";
import Gallery from "@/pages/Gallery";
import Calls from "@/pages/Calls";
import Playlist from "@/pages/Playlist";
import MapView from "@/pages/MapView";
import Us from "@/pages/Us";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
  const { user, loading } = useAuth();
  const { isAppLocked } = useTheme();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  usePushNotifications();

  useEffect(() => {
    if (!user) {
      setNeedsOnboarding(null);
      return;
    }
    const checkProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("gender, display_name")
        .eq("user_id", user.id)
        .single();
      setNeedsOnboarding(!data?.gender);
    };
    checkProfile();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 rounded-full bg-muted mx-auto flex items-center justify-center">
            <span className="text-lg">💕</span>
          </div>
          <p className="text-xs text-muted-foreground animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (needsOnboarding === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-xs text-muted-foreground animate-pulse">Setting up...</p>
      </div>
    );
  }

  if (needsOnboarding) {
    return <Onboarding onComplete={() => setNeedsOnboarding(false)} />;
  }

  if (isAppLocked) return <AppLockScreen />;

  return <AppLayout />;
};

const AuthRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/chat" replace />;
  return <Auth />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/index" element={<Navigate to="/chat" replace />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/chat" element={<Chat />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/calls" element={<Calls />} />
              <Route path="/playlist" element={<Playlist />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/us" element={<Us />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
