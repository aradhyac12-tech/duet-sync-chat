import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import AppLayout from "@/components/AppLayout";
import AppLockScreen from "@/components/AppLockScreen";
import PeekGuard from "@/components/PeekGuard";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import Onboarding from "@/pages/Onboarding";
import { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import storage from "@/lib/storage";

// Lazy chunks with preload handles so we can warm them on app mount / nav hover.
const ChatImport = () => import("@/pages/Chat");
const GalleryImport = () => import("@/pages/Gallery");
const CallsImport = () => import("@/pages/Calls");
const PlaylistImport = () => import("@/pages/Playlist");
const ShayariImport = () => import("@/pages/Shayari");
const MapImport = () => import("@/pages/MapView");
const UsImport = () => import("@/pages/Us");
const SettingsImport = () => import("@/pages/Settings");

const Chat = lazy(ChatImport);
const Gallery = lazy(GalleryImport);
const Calls = lazy(CallsImport);
const Playlist = lazy(PlaylistImport);
const Shayari = lazy(ShayariImport);
const MapView = lazy(MapImport);
const Us = lazy(UsImport);
const Settings = lazy(SettingsImport);
const NotFound = lazy(() => import("@/pages/NotFound"));

// Expose preloaders so BottomNav can warm a chunk on touchstart/hover.
export const routePreload: Record<string, () => Promise<unknown>> = {
  "/chat": ChatImport,
  "/gallery": GalleryImport,
  "/calls": CallsImport,
  "/playlist": PlaylistImport,
  "/shayari": ShayariImport,
  "/map": MapImport,
  "/us": UsImport,
  "/settings": SettingsImport,
};

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <p className="text-xs text-muted-foreground animate-pulse">Loading...</p>
  </div>
);

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
            <span className="text-sm font-semibold text-muted-foreground">
              {(storage.get("duo-app-name") || "DS").slice(0, 2).toUpperCase()}
            </span>
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

  return (
    <Suspense fallback={<PageFallback />}>
      <AppLayout />
    </Suspense>
  );
};

const AuthRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    const params = new URLSearchParams(window.location.search);
    const pendingInvite = params.get("invite") || sessionStorage.getItem("duo-pending-invite");
    if (pendingInvite) return <Navigate to={`/settings?invite=${encodeURIComponent(pendingInvite)}`} replace />;
    return <Navigate to="/chat" replace />;
  }
  return <Auth />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PeekGuard />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/index" element={<Navigate to="/chat" replace />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/chat" element={<Chat />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/calls" element={<Calls />} />
              <Route path="/playlist" element={<Playlist />} />
              <Route path="/shayari" element={<Shayari />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/us" element={<Us />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
