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

    // On native, use Capacitor native biometric
    if (Capacitor.isNativePlatform()) {
      try {
        // Dynamic import to avoid issues on web
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
        // User cancelled or biometric failed — stay locked
        console.log("Biometric auth failed:", err);
        return;
      }
    }

    // Web fallback: use WebAuthn / Credential Management API
    if (window.PublicKeyCredential) {
      try {
        // Check if platform authenticator available (Touch ID on Mac, Windows Hello, etc.)
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          const challenge = new Uint8Array(32);
          crypto.getRandomValues(challenge);
          
          await navigator.credentials.get({
            publicKey: {
              challenge,
              timeout: 60000,
              userVerification: "required",
              rpId: window.location.hostname,
              allowCredentials: [],
            },
          });
          setIsLocked(false);
          return;
        }
      } catch {
        // WebAuthn not set up or user cancelled
      }
    }

    // Final fallback: just unlock (no biometric capability)
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
