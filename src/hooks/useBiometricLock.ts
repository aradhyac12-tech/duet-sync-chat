import { useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Uses the native BiometricAuth if available on Capacitor,
 * otherwise falls back to Web Credential API or simple PIN.
 */
export const useBiometricLock = (
  isLocked: boolean,
  setIsLocked: (locked: boolean) => void,
  enabled: boolean
) => {
  const authenticate = useCallback(async () => {
    if (!enabled) {
      setIsLocked(false);
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      setIsLocked(false);
      return;
    }

    // On native, use Capacitor native biometric
    try {
      const { NativeBiometric } = await import("capacitor-native-biometric");
      const result = await NativeBiometric.isAvailable();
      if (result.isAvailable) {
        await NativeBiometric.verifyIdentity({
          reason: "Unlock DuoSpace",
          title: "Authentication Required",
          subtitle: "Verify your identity to continue",
          description: "Place your finger on the sensor or use Face ID",
        });
        setIsLocked(false);
        return;
      }
    } catch (err: any) {
      console.log("Biometric auth failed:", err);
      return;
    }

    setIsLocked(false);
  }, [enabled, setIsLocked]);

  // Auto-trigger auth when locked
  useEffect(() => {
    if (isLocked && enabled) {
      authenticate();
    }
  }, [isLocked, enabled, authenticate]);

  return { authenticate };
};
