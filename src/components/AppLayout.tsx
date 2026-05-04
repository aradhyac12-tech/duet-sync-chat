import { Outlet, useNavigate } from "react-router-dom";
import { useCallback } from "react";
import FloatingDock from "@/components/FloatingDock";
import SurpriseOverlay from "@/components/SurpriseOverlay";
import MoodDetector from "@/components/MoodDetector";
import EmojiScreenEffect from "@/components/EmojiScreenEffect";
import OfflineBanner from "@/components/OfflineBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAppNative } from "@/hooks/useAppNative";
import { useTheme } from "@/contexts/ThemeContext";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useToast } from "@/hooks/use-toast";
import { logError } from "@/lib/telemetry";

const AppLayout = () => {
  const { isAppLocked, setIsAppLocked, appSettings } = useTheme();
  const { isOnline } = useAppNative(isAppLocked, setIsAppLocked, appSettings.biometricLock);
  const navigate = useNavigate();
  const { toast } = useToast();

  // FIX AUDIT #4: Session guard handles token expiry, refresh failures, multi-device conflicts
  const handleSessionExpired = useCallback(() => {
    toast({
      title: "Session expired",
      description: "Please sign in again.",
      variant: "destructive",
    });
    navigate("/auth", { replace: true });
  }, [toast, navigate]);

  const handleRefreshFailed = useCallback((err: unknown) => {
    logError("AppLayout", "token refresh failed", err);
    toast({
      title: "Connection issue",
      description: "Couldn't refresh your session. Some features may be unavailable.",
    });
  }, [toast]);

  const handleSessionConflict = useCallback(() => {
    toast({
      title: "Signed in on another device",
      description: "Your session has been updated.",
    });
  }, [toast]);

  // FIX AUDIT #4: mount session guard at layout level so it covers all pages
  useSessionGuard({
    onExpired: handleSessionExpired,
    onRefreshFailed: handleRefreshFailed,
    onSessionConflict: handleSessionConflict,
  });

  return (
    // FIX AUDIT #13: no-overscroll prevents iOS bounce exposing white bar behind notch
    <div className="h-[100dvh] bg-background overflow-x-hidden flex flex-col no-overscroll">
      <OfflineBanner isOnline={isOnline} />
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* FIX AUDIT #2: Error boundary per page so one crash doesn't kill the whole app */}
        <ErrorBoundary context="PageContent">
          <Outlet />
        </ErrorBoundary>
      </main>
      <FloatingDock />
      <SurpriseOverlay />
      <MoodDetector />
      <EmojiScreenEffect />
    </div>
  );
};

export default AppLayout;
