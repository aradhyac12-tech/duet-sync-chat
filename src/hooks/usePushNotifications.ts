import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from "@capacitor/push-notifications";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export const usePushNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const isPlatformSupported = Capacitor.isNativePlatform();
    setIsSupported(isPlatformSupported);

    if (!isPlatformSupported || !user) return;

    const initPushNotifications = async () => {
      try {
        // Request permission
        const permStatus = await PushNotifications.requestPermissions();
        
        if (permStatus.receive === "granted") {
          // Register for push notifications
          await PushNotifications.register();
        } else {
          console.log("Push notification permission denied");
        }
      } catch (error) {
        console.error("Error initializing push notifications:", error);
      }
    };

    // Listen for registration success
    const registrationListener = PushNotifications.addListener("registration", async (token: Token) => {
      console.log("Push registration success, token:", token.value);
      setPushToken(token.value);
      
      // Store token in database for the user (you'd need a push_tokens table)
      // For now, just log it
      console.log("Device registered for push notifications");
    });

    // Listen for registration errors
    const errorListener = PushNotifications.addListener("registrationError", (error) => {
      console.error("Push registration error:", error);
    });

    // Listen for incoming notifications when app is in foreground
    const notificationListener = PushNotifications.addListener(
      "pushNotificationReceived",
      (notification: PushNotificationSchema) => {
        console.log("Push notification received:", notification);
        toast({
          title: notification.title || "New notification",
          description: notification.body,
        });
      }
    );

    // Listen for notification tap/action
    const actionListener = PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action: ActionPerformed) => {
        console.log("Push notification action performed:", action);
        // Handle navigation based on notification data
        const data = action.notification.data;
        if (data?.type === "message") {
          window.location.href = "/chat";
        } else if (data?.type === "call") {
          window.location.href = "/calls";
        }
      }
    );

    initPushNotifications();

    return () => {
      registrationListener.then((l) => l.remove());
      errorListener.then((l) => l.remove());
      notificationListener.then((l) => l.remove());
      actionListener.then((l) => l.remove());
    };
  }, [user, toast]);

  return { pushToken, isSupported };
};
