import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Capacitor } from "@capacitor/core";

export type ThemeColor = "soft-neutral" | "midnight" | "ocean" | "rose" | "forest" | "lavender";

interface AppSettings {
  biometricLock: boolean;
  notifications: boolean;
  hapticFeedback: boolean;
  privacyMode: boolean;
  peekGuard: boolean;
  peekFaceThreshold: number;   // how many faces to trigger (2–5)
  peekDetectionDelay: number;  // sustained detection ms (500–5000)
  peekCheckInterval: number;   // detection interval ms (300–2000)
}

interface ThemeContextType {
  theme: ThemeColor;
  setTheme: (theme: ThemeColor) => void;
  chatWallpaper: string | null;
  setChatWallpaper: (wp: string | null) => void;
  appSettings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  isAppLocked: boolean;
  setIsAppLocked: (locked: boolean) => void;
}

const defaultSettings: AppSettings = {
  biometricLock: false,
  notifications: true,
  hapticFeedback: true,
  privacyMode: false,
  peekGuard: false,
  peekFaceThreshold: 2,
  peekDetectionDelay: 1500,
  peekCheckInterval: 800,
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "soft-neutral",
  setTheme: () => {},
  chatWallpaper: null,
  setChatWallpaper: () => {},
  appSettings: defaultSettings,
  updateSetting: () => {},
  isAppLocked: false,
  setIsAppLocked: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const themeStyles: Record<ThemeColor, Record<string, string>> = {
  "soft-neutral": {
    "--background": "30 25% 96%",
    "--foreground": "0 0% 17%",
    "--card": "30 20% 98%",
    "--card-foreground": "0 0% 17%",
    "--primary": "28 15% 72%",
    "--primary-foreground": "0 0% 17%",
    "--secondary": "30 12% 90%",
    "--secondary-foreground": "0 0% 17%",
    "--muted": "30 10% 92%",
    "--muted-foreground": "0 0% 45%",
    "--accent": "28 18% 82%",
    "--accent-foreground": "0 0% 17%",
    "--border": "28 12% 88%",
    "--input": "28 12% 88%",
    "--ring": "28 15% 72%",
    "--warm": "30 25% 96%",
    "--taupe": "28 15% 72%",
    "--sand": "30 20% 85%",
  },
  midnight: {
    "--background": "230 20% 10%",
    "--foreground": "220 15% 90%",
    "--card": "230 18% 13%",
    "--card-foreground": "220 15% 90%",
    "--primary": "220 40% 55%",
    "--primary-foreground": "220 15% 95%",
    "--secondary": "230 15% 18%",
    "--secondary-foreground": "220 15% 90%",
    "--muted": "230 12% 16%",
    "--muted-foreground": "220 10% 50%",
    "--accent": "220 30% 25%",
    "--accent-foreground": "220 15% 90%",
    "--border": "230 12% 18%",
    "--input": "230 12% 18%",
    "--ring": "220 40% 55%",
    "--warm": "230 20% 12%",
    "--taupe": "220 15% 45%",
    "--sand": "230 12% 20%",
  },
  ocean: {
    "--background": "195 30% 95%",
    "--foreground": "200 25% 15%",
    "--card": "195 25% 97%",
    "--card-foreground": "200 25% 15%",
    "--primary": "195 50% 55%",
    "--primary-foreground": "200 25% 15%",
    "--secondary": "195 20% 90%",
    "--secondary-foreground": "200 25% 15%",
    "--muted": "195 15% 91%",
    "--muted-foreground": "200 10% 45%",
    "--accent": "195 30% 82%",
    "--accent-foreground": "200 25% 15%",
    "--border": "195 18% 87%",
    "--input": "195 18% 87%",
    "--ring": "195 50% 55%",
    "--warm": "195 30% 95%",
    "--taupe": "195 20% 65%",
    "--sand": "195 20% 85%",
  },
  rose: {
    "--background": "350 30% 96%",
    "--foreground": "350 15% 15%",
    "--card": "350 25% 98%",
    "--card-foreground": "350 15% 15%",
    "--primary": "350 45% 65%",
    "--primary-foreground": "350 15% 15%",
    "--secondary": "350 18% 91%",
    "--secondary-foreground": "350 15% 15%",
    "--muted": "350 12% 92%",
    "--muted-foreground": "350 8% 45%",
    "--accent": "350 25% 85%",
    "--accent-foreground": "350 15% 15%",
    "--border": "350 15% 88%",
    "--input": "350 15% 88%",
    "--ring": "350 45% 65%",
    "--warm": "350 30% 96%",
    "--taupe": "350 15% 68%",
    "--sand": "350 18% 86%",
  },
  forest: {
    "--background": "150 20% 95%",
    "--foreground": "150 20% 12%",
    "--card": "150 18% 97%",
    "--card-foreground": "150 20% 12%",
    "--primary": "155 35% 50%",
    "--primary-foreground": "150 20% 12%",
    "--secondary": "150 15% 90%",
    "--secondary-foreground": "150 20% 12%",
    "--muted": "150 10% 91%",
    "--muted-foreground": "150 8% 42%",
    "--accent": "150 22% 82%",
    "--accent-foreground": "150 20% 12%",
    "--border": "150 12% 87%",
    "--input": "150 12% 87%",
    "--ring": "155 35% 50%",
    "--warm": "150 20% 95%",
    "--taupe": "150 12% 62%",
    "--sand": "150 15% 85%",
  },
  lavender: {
    "--background": "270 25% 96%",
    "--foreground": "270 15% 15%",
    "--card": "270 20% 98%",
    "--card-foreground": "270 15% 15%",
    "--primary": "270 40% 65%",
    "--primary-foreground": "270 15% 15%",
    "--secondary": "270 15% 91%",
    "--secondary-foreground": "270 15% 15%",
    "--muted": "270 10% 92%",
    "--muted-foreground": "270 8% 45%",
    "--accent": "270 22% 84%",
    "--accent-foreground": "270 15% 15%",
    "--border": "270 12% 88%",
    "--input": "270 12% 88%",
    "--ring": "270 40% 65%",
    "--warm": "270 25% 96%",
    "--taupe": "270 12% 65%",
    "--sand": "270 15% 86%",
  },
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const isNativePlatform = Capacitor.isNativePlatform();
  const [theme, setThemeState] = useState<ThemeColor>(() => {
    return (localStorage.getItem("duo-theme") as ThemeColor) || "soft-neutral";
  });
  const [chatWallpaper, setChatWallpaperState] = useState<string | null>(() => {
    return localStorage.getItem("duo-wallpaper") || null;
  });
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("duo-settings");
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });
  const [isAppLocked, setIsAppLocked] = useState(false);

  const setTheme = (t: ThemeColor) => {
    setThemeState(t);
    localStorage.setItem("duo-theme", t);
  };

  const setChatWallpaper = (wp: string | null) => {
    setChatWallpaperState(wp);
    if (wp) localStorage.setItem("duo-wallpaper", wp);
    else localStorage.removeItem("duo-wallpaper");
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setAppSettings((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem("duo-settings", JSON.stringify(next));
      return next;
    });
  };

  // Privacy mode: blur app when switching away
  useEffect(() => {
    if (!appSettings.privacyMode) return;
    const handleBlur = () => {
      document.body.style.filter = "blur(20px)";
      document.body.style.transition = "filter 0.15s ease";
    };
    const handleFocus = () => {
      document.body.style.filter = "";
    };
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) handleBlur();
      else handleFocus();
    });
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.body.style.filter = "";
    };
  }, [appSettings.privacyMode]);

  // App lock: lock when tab goes hidden (if biometric lock is on)
  useEffect(() => {
    if (!appSettings.biometricLock || !isNativePlatform) {
      setIsAppLocked(false);
      return;
    }

    const handleHidden = () => {
      if (document.hidden) setIsAppLocked(true);
    };

    document.addEventListener("visibilitychange", handleHidden);
    return () => document.removeEventListener("visibilitychange", handleHidden);
  }, [appSettings.biometricLock, isNativePlatform]);

  useEffect(() => {
    const root = document.documentElement;
    const styles = themeStyles[theme];
    Object.entries(styles).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, chatWallpaper, setChatWallpaper, appSettings, updateSetting, isAppLocked, setIsAppLocked }}>
      {children}
    </ThemeContext.Provider>
  );
};
