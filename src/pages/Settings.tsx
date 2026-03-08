import PageHeader from "@/components/PageHeader";
import { motion } from "framer-motion";
import { useTheme, ThemeColor } from "@/contexts/ThemeContext";
import { ChevronLeft, Check, ImageIcon, X, Shield, Bell, Fingerprint, Vibrate, Link2, Unlink, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

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
  const { theme, setTheme, chatWallpaper, setChatWallpaper, appSettings, updateSetting } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [partnerEmail, setPartnerEmail] = useState("");
  const [currentPartner, setCurrentPartner] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState("");
  const [petName, setPetName] = useState("");
  const [editingPetName, setEditingPetName] = useState(false);
  const [myProfile, setMyProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("profiles").select("partner_id, display_name, gender, phone_number, pet_name").eq("user_id", user.id).single();
      if (data) {
        setMyProfile(data);
        if (data.partner_id) {
          setCurrentPartner(data.partner_id);
          const { data: pp } = await supabase.from("profiles").select("display_name, pet_name").eq("user_id", data.partner_id).single();
          if (pp) {
            setPartnerName(pp.display_name);
            // pet_name on partner's profile = what they call us. We want to edit the pet_name on OUR partner's row
          }
        }
      }
      // Get pet name we've given our partner (stored on partner's profile)
      if (data?.partner_id) {
        const { data: pp } = await supabase.from("profiles").select("pet_name").eq("user_id", data.partner_id).single();
        // Actually, pet_name should be stored on OUR profile as what our PARTNER calls us
        // Let's store it differently: pet_name on a profile = what their partner calls them
        if (pp) setPetName(pp.pet_name || "");
      }
    };
    load();
  }, [user]);

  const linkPartner = async () => {
    if (!user || !partnerEmail.trim()) return;
    const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").neq("user_id", user.id);
    const partner = profiles?.find((p) => p.display_name === partnerEmail || p.user_id === partnerEmail);
    
    if (!partner) {
      toast({ title: "Not found", description: "No user found with that email. They need to sign up first.", variant: "destructive" });
      return;
    }

    await supabase.from("profiles").update({ partner_id: partner.user_id }).eq("user_id", user.id);
    await supabase.from("profiles").update({ partner_id: user.id }).eq("user_id", partner.user_id);
    
    setCurrentPartner(partner.user_id);
    setPartnerName(partner.display_name);
    setShowPartnerDialog(false);
    toast({ title: "Linked! 💕", description: `You're now connected with ${partner.display_name}` });
  };

  const savePetName = async () => {
    if (!user || !currentPartner) return;
    // Store pet_name on the partner's profile (what WE call them)
    await supabase.from("profiles").update({ pet_name: petName.trim() || null }).eq("user_id", currentPartner);
    setEditingPetName(false);
    toast({ title: "Pet name saved 💕" });
  };

  const unlinkPartner = async () => {
    if (!user || !currentPartner) return;
    await supabase.from("profiles").update({ partner_id: null }).eq("user_id", user.id);
    await supabase.from("profiles").update({ partner_id: null }).eq("user_id", currentPartner);
    setCurrentPartner(null);
    setPartnerName("");
    toast({ title: "Unlinked" });
  };

  const settingsItems = [
    { key: "biometricLock" as const, icon: Fingerprint, label: "App Lock", desc: "Lock app when switching away. Tap to unlock." },
    { key: "notifications" as const, icon: Bell, label: "Notifications", desc: "Push notifications for messages" },
    { key: "hapticFeedback" as const, icon: Vibrate, label: "Haptic Feedback", desc: "Vibrate on interactions" },
    { key: "privacyMode" as const, icon: EyeOff, label: "Privacy Screen", desc: "Blur app in task switcher & when looked at by others" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pb-24">
      <PageHeader title="Settings" subtitle="Make it yours">
        <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
      </PageHeader>

      <div className="px-5 space-y-6">
        {/* Partner Link */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Partner</h2>
          {currentPartner ? (
            <div className="space-y-2">
              <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center text-lg">💕</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{partnerName}</p>
                  <p className="text-[11px] text-muted-foreground">Linked</p>
                </div>
                <button onClick={unlinkPartner} className="h-8 px-3 rounded-lg bg-muted text-xs flex items-center gap-1">
                  <Unlink className="h-3 w-3" /> Unlink
                </button>
              </div>
              {/* Pet name */}
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Pet name for {partnerName}</p>
                {editingPetName ? (
                  <div className="flex gap-2">
                    <Input value={petName} onChange={(e) => setPetName(e.target.value)}
                      placeholder="e.g. Baby, Love, Jaan..."
                      className="h-9 rounded-xl text-sm flex-1" autoFocus />
                    <Button onClick={savePetName} size="sm" className="rounded-xl bg-foreground text-background h-9 px-4">Save</Button>
                  </div>
                ) : (
                  <button onClick={() => setEditingPetName(true)} className="text-sm text-left w-full">
                    {petName || <span className="text-muted-foreground">Tap to set a pet name</span>}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button onClick={() => setShowPartnerDialog(true)}
              className="w-full bg-card rounded-2xl border border-border p-4 flex items-center gap-3 text-left">
              <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                <Link2 className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Link with partner</p>
                <p className="text-[11px] text-muted-foreground">Connect to start sharing</p>
              </div>
            </button>
          )}
        </section>

        {/* Theme Picker */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Color Theme</h2>
          <div className="grid grid-cols-3 gap-3">
            {themes.map((t) => (
              <button key={t.id} onClick={() => setTheme(t.id)}
                className={cn("relative rounded-2xl border-2 p-3 transition-all", theme === t.id ? "border-foreground" : "border-border")}>
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
              <button key={wp.id} onClick={() => setChatWallpaper(wp.style)}
                className={cn("aspect-[3/4] rounded-xl border-2 transition-all", chatWallpaper === wp.style ? "border-foreground" : "border-border")}
                style={{ background: wp.style }} />
            ))}
          </div>
          <button onClick={() => setShowWallpaperPicker(!showWallpaperPicker)}
            className="mt-3 w-full flex items-center gap-2 bg-card rounded-xl border border-border p-3 text-sm">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <span>Choose from gallery</span>
          </button>
          {showWallpaperPicker && (
            <div className="mt-2 bg-card rounded-xl border border-border p-4">
              <label className="flex flex-col items-center gap-2 cursor-pointer">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Select an image</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => { setChatWallpaper(`url(${reader.result})`); setShowWallpaperPicker(false); };
                      reader.readAsDataURL(file);
                    }
                  }} />
              </label>
            </div>
          )}
        </section>

        {/* Device & Privacy Features */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Privacy & Device</h2>
          <div className="space-y-1">
            {settingsItems.map((item) => (
              <div key={item.key} className="flex items-center gap-3 p-3 rounded-xl">
                <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
                  <item.icon className="h-4 w-4 text-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
                <Switch
                  checked={appSettings[item.key]}
                  onCheckedChange={(val) => {
                    updateSetting(item.key, val);
                    toast({ title: `${item.label} ${val ? "enabled" : "disabled"}` });
                  }}
                />
              </div>
            ))}
          </div>

          {/* Privacy info */}
          {appSettings.privacyMode && (
            <div className="mt-3 bg-primary/5 rounded-xl p-3 flex items-start gap-2">
              <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-primary">Privacy Screen Active</p>
                <p className="text-[11px] text-muted-foreground">App blurs when you switch apps or someone looks over your shoulder. Notifications show "New message" only.</p>
              </div>
            </div>
          )}
        </section>

        {/* Account */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Account</h2>
          <p className="text-xs text-muted-foreground mb-2">{user?.email}</p>
          <button
            onClick={async () => { await supabase.auth.signOut(); }}
            className="w-full bg-card rounded-xl border border-border p-3 text-sm text-destructive text-center">
            Sign Out
          </button>
        </section>
      </div>

      {/* Partner link dialog */}
      <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Link with your partner</DialogTitle>
            <DialogDescription>Enter your partner's name or email. They need to have an account first.</DialogDescription>
          </DialogHeader>
          <Input value={partnerEmail} onChange={(e) => setPartnerEmail(e.target.value)}
            placeholder="Partner's name or email" className="rounded-xl" />
          <DialogFooter>
            <Button onClick={linkPartner} className="rounded-xl bg-foreground text-background w-full">Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Settings;
