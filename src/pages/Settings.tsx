import PageHeader from "@/components/PageHeader";
import { motion } from "framer-motion";
import { useTheme, ThemeColor } from "@/contexts/ThemeContext";
import { ChevronLeft, Check, ImageIcon, X, Shield, Bell, Fingerprint, Vibrate } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";

const themes: { id: ThemeColor; name: string; preview: string; accent: string }[] = [
  { id: "soft-neutral", name: "Soft Neutral", preview: "bg-[hsl(30,25%,96%)]", accent: "bg-[hsl(28,15%,72%)]" },
  { id: "midnight", name: "Midnight", preview: "bg-[hsl(230,20%,10%)]", accent: "bg-[hsl(220,40%,55%)]" },
  { id: "ocean", name: "Ocean", preview: "bg-[hsl(195,30%,95%)]", accent: "bg-[hsl(195,50%,55%)]" },
  { id: "rose", name: "Rosé", preview: "bg-[hsl(350,30%,96%)]", accent: "bg-[hsl(350,45%,65%)]" },
  { id: "forest", name: "Forest", preview: "bg-[hsl(150,20%,95%)]", accent: "bg-[hsl(155,35%,50%)]" },
  { id: "lavender", name: "Lavender", preview: "bg-[hsl(270,25%,96%)]", accent: "bg-[hsl(270,40%,65%)]" },
];

const presetWallpapers = [
  { id: "gradient-1", style: "linear-gradient(135deg, hsl(28,15%,90%) 0%, hsl(28,20%,82%) 100%)" },
  { id: "gradient-2", style: "linear-gradient(180deg, hsl(220,30%,15%) 0%, hsl(230,20%,8%) 100%)" },
  { id: "gradient-3", style: "linear-gradient(135deg, hsl(195,30%,88%) 0%, hsl(200,40%,75%) 100%)" },
  { id: "gradient-4", style: "linear-gradient(135deg, hsl(350,30%,90%) 0%, hsl(340,35%,80%) 100%)" },
  { id: "gradient-5", style: "linear-gradient(135deg, hsl(150,20%,88%) 0%, hsl(155,30%,75%) 100%)" },
  { id: "gradient-6", style: "linear-gradient(135deg, hsl(270,25%,90%) 0%, hsl(260,30%,80%) 100%)" },
];

const Settings = () => {
  const { theme, setTheme, chatWallpaper, setChatWallpaper } = useTheme();
  const navigate = useNavigate();
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pb-24">
      <PageHeader title="Settings" subtitle="Make it yours">
        <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
      </PageHeader>

      <div className="px-5 space-y-6">
        {/* Theme Picker */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Color Theme</h2>
          <div className="grid grid-cols-3 gap-3">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  "relative rounded-2xl border-2 p-3 transition-all",
                  theme === t.id ? "border-foreground" : "border-border"
                )}
              >
                <div className="flex gap-1.5 mb-2">
                  <div className={cn("h-6 w-6 rounded-lg", t.preview)} />
                  <div className={cn("h-6 w-6 rounded-lg", t.accent)} />
                </div>
                <p className="text-[11px] font-medium text-left">{t.name}</p>
                {theme === t.id && (
                  <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-foreground flex items-center justify-center">
                    <Check className="h-3 w-3 text-background" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Chat Wallpaper */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chat Wallpaper</h2>
            {chatWallpaper && (
              <button onClick={() => setChatWallpaper(null)} className="text-xs text-muted-foreground flex items-center gap-1">
                <X className="h-3 w-3" /> Remove
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {presetWallpapers.map((wp) => (
              <button
                key={wp.id}
                onClick={() => setChatWallpaper(wp.style)}
                className={cn(
                  "aspect-[3/4] rounded-xl border-2 transition-all",
                  chatWallpaper === wp.style ? "border-foreground" : "border-border"
                )}
                style={{ background: wp.style }}
              />
            ))}
          </div>
          <button
            onClick={() => setShowWallpaperPicker(!showWallpaperPicker)}
            className="mt-3 w-full flex items-center gap-2 bg-card rounded-xl border border-border p-3 text-sm"
          >
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <span>Choose from gallery</span>
          </button>
          {showWallpaperPicker && (
            <div className="mt-2 bg-card rounded-xl border border-border p-4">
              <label className="flex flex-col items-center gap-2 cursor-pointer">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Select an image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        setChatWallpaper(`url(${reader.result})`);
                        setShowWallpaperPicker(false);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>
          )}
        </section>

        {/* Native Features */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Device Features</h2>
          <div className="space-y-1">
            {[
              { icon: Fingerprint, label: "Biometric Lock", desc: "Require fingerprint or Face ID" },
              { icon: Bell, label: "Notifications", desc: "Push notifications for messages" },
              { icon: Vibrate, label: "Haptic Feedback", desc: "Vibrate on interactions" },
              { icon: Shield, label: "Privacy", desc: "Hide previews in app switcher" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
                  <item.icon className="h-4 w-4 text-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
                <div className="h-6 w-10 rounded-full bg-muted relative cursor-pointer">
                  <div className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-muted-foreground/40 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Account */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Account</h2>
          <button
            onClick={async () => {
              const { supabase } = await import("@/integrations/supabase/client");
              await supabase.auth.signOut();
            }}
            className="w-full bg-card rounded-xl border border-border p-3 text-sm text-destructive text-center"
          >
            Sign Out
          </button>
        </section>
      </div>
    </motion.div>
  );
};

export default Settings;
