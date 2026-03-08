import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

export const hapticLight = async () => {
  if (Capacitor.isNativePlatform()) {
    await Haptics.impact({ style: ImpactStyle.Light });
  }
};

export const hapticMedium = async () => {
  if (Capacitor.isNativePlatform()) {
    await Haptics.impact({ style: ImpactStyle.Medium });
  }
};

export const hapticHeavy = async () => {
  if (Capacitor.isNativePlatform()) {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  }
};

export const hapticNotification = async () => {
  if (Capacitor.isNativePlatform()) {
    await Haptics.notification({ type: "SUCCESS" as any });
  }
};
