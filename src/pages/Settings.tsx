import { motion } from "framer-motion";
import { useTheme, ThemeColor } from "@/contexts/ThemeContext";
import { ChevronLeft, Check, ImageIcon, X, Bell, Fingerprint, Vibrate, Link2, Unlink, EyeOff, Copy, Share2, Eye } from "lucide-react";
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
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [currentPartner, setCurrentPartner] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState("");
  const [petName, setPetName] = useState("");
  const [editingPetName, setEditingPetName] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("profiles").select("partner_id, display_name, gender, phone_number, pet_name").eq("user_id", user.id).single();
      if (data?.partner_id) {
        setCurrentPartner(data.partner_id);
        const { data: pp } = await supabase.from("profiles").select("display_name, pet_name").eq("user_id", data.partner_id).single();
        if (pp) {
          setPartnerName(pp.display_name);
          setPetName(pp.pet_name || "");
        }
      }
    };
    load();
  }, [user]);

  const generateInviteLink = async () => {
    if (!user) return;
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { error } = await supabase.from("invite_links").insert({
      code,
      creator_id: user.id,
    } as any);
    if (error) {
      toast({ title: "Failed to create invite", description: error.message, variant: "destructive" });
      return;
    }
    setInviteCode(code);
    setShowInviteDialog(true);
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/auth?invite=${inviteCode}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copied! 📋", description: "Share this with your partner" });
  };

  const shareInviteLink = async () => {
    const link = `${window.location.origin}/auth?invite=${inviteCode}`;
    if (navigator.share) {
      await navigator.share({ title: "Join me on DuoSpace", text: "Use this link to connect with me on DuoSpace", url: link });
    } else {
      copyInviteLink();
    }
  };

  const acceptInvite = async () => {
    if (!user || !joinCode.trim()) return;
    const code = joinCode.trim().toUpperCase();

    // Find the invite
    const { data: invite } = await supabase
      .from("invite_links")
      .select("*")
      .eq("code", code)
      .is("used_by", null)
      .single() as any;

    if (!invite) {
      toast({ title: "Invalid or expired code", variant: "destructive" });
      return;
    }

    if (invite.creator_id === user.id) {
      toast({ title: "Can't use your own invite", variant: "destructive" });
      return;
    }

    // Link partners
    await supabase.from("profiles").update({ partner_id: invite.creator_id }).eq("user_id", user.id);
    await supabase.from("profiles").update({ partner_id: user.id }).eq("user_id", invite.creator_id);

    // Mark invite as used
    await supabase.from("invite_links").update({ used_by: user.id, used_at: new Date().toISOString() } as any).eq("id", invite.id);

    setCurrentPartner(invite.creator_id);
    const { data: pp } = await supabase.from("profiles").select("display_name").eq("user_id", invite.creator_id).single();
    if (pp) setPartnerName(pp.display_name);

    setShowPartnerDialog(false);
    setJoinCode("");
    toast({ title: "Connected! 💕", description: `You're now linked with ${pp?.display_name || "your partner"}` });
  };

  const unlinkPartner = async () => {
    if (!user || !currentPartner) return;
    await supabase.from("profiles").update({ partner_id: null }).eq("user_id", user.id);
    await supabase.from("profiles").update({ partner_id: null }).eq("user_id", currentPartner);
    setCurrentPartner(null);
    setPartnerName("");
    toast({ title: "Unlinked" });
  };

  const savePetName = async () => {
    if (!user || !currentPartner) return;
    await supabase.from("profiles").update({ pet_name: petName.trim() || null }).eq("user_id", currentPartner);
    setEditingPetName(false);
    toast({ title: "Saved 💕" });
  };

  const settingsItems = [
    { key: "biometricLock" as const, icon: Fingerprint, label: "App Lock", desc: "Require unlock when switching back" },
    { key: "notifications" as const, icon: Bell, label: "Notifications", desc: "Message & call alerts" },
    { key: "hapticFeedback" as const, icon: Vibrate, label: "Haptics", desc: "Vibrate on interactions" },
    { key: "privacyMode" as const, icon: EyeOff, label: "Privacy", desc: "Blur in task switcher" },
    { key: "peekGuard" as const, icon: Eye, label: "Peek Guard", desc: "Camera detects if someone is watching" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <header className="safe-top px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="h-8 w-8 rounded-full bg-accent/60 flex items-center justify-center">
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        </div>
      </header>

      <div className="px-5 space-y-6">
        {/* Partner */}
        <section>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2.5">Partner</p>
          {currentPartner ? (
            <div className="space-y-2">
              <div className="bg-card rounded-2xl border border-border/60 p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-accent/50 flex items-center justify-center text-lg">💕</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{partnerName}</p>
                  <p className="text-[11px] text-muted-foreground">Connected</p>
                </div>
                <button onClick={unlinkPartner} className="h-7 px-3 rounded-full bg-muted text-[11px] flex items-center gap-1 text-muted-foreground">
                  <Unlink className="h-3 w-3" /> Unlink
                </button>
              </div>
              <div className="bg-card rounded-2xl border border-border/60 p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Pet name</p>
                {editingPetName ? (
                  <div className="flex gap-2">
                    <Input value={petName} onChange={(e) => setPetName(e.target.value)}
                      placeholder="Baby, Love, Jaan..." className="h-8 rounded-full text-sm flex-1" autoFocus />
                    <Button onClick={savePetName} size="sm" className="rounded-full bg-foreground text-background h-8 px-4 text-xs">Save</Button>
                  </div>
                ) : (
                  <button onClick={() => setEditingPetName(true)} className="text-sm text-left w-full">
                    {petName || <span className="text-muted-foreground">Tap to set</span>}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button onClick={generateInviteLink}
                className="w-full bg-foreground text-background rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
                <div className="h-10 w-10 rounded-full bg-background/10 flex items-center justify-center">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Create invite link</p>
                  <p className="text-[11px] opacity-60">Share with your partner to connect</p>
                </div>
              </button>
              <button onClick={() => setShowPartnerDialog(true)}
                className="w-full bg-card rounded-2xl border border-border/60 p-4 flex items-center gap-3 text-left">
                <div className="h-10 w-10 rounded-full bg-accent/50 flex items-center justify-center">
                  <Share2 className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Enter invite code</p>
                  <p className="text-[11px] text-muted-foreground">Got a code from your partner?</p>
                </div>
              </button>
            </div>
          )}
        </section>

        {/* Themes */}
        <section>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2.5">Theme</p>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((t) => (
              <button key={t.id} onClick={() => setTheme(t.id)}
                className={cn("relative rounded-xl border-2 p-2.5 transition-all", theme === t.id ? "border-foreground" : "border-border/40")}>
                <div className="flex gap-1 mb-1.5">
                  <div className={cn("h-5 w-5 rounded-md", t.preview)} />
                  <div className={cn("h-5 w-5 rounded-md", t.accent)} />
                </div>
                <p className="text-[10px] font-medium text-left">{t.name}</p>
                {theme === t.id && (
                  <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-foreground flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-background" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Wallpaper */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Wallpaper</p>
            {chatWallpaper && (
              <button onClick={() => setChatWallpaper(null)} className="text-[11px] text-muted-foreground flex items-center gap-1">
                <X className="h-3 w-3" /> Reset
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {presetWallpapers.map((wp) => (
              <button key={wp.id} onClick={() => setChatWallpaper(wp.style)}
                className={cn("aspect-[3/4] rounded-xl border-2 transition-all", chatWallpaper === wp.style ? "border-foreground" : "border-border/30")}
                style={{ background: wp.style }} />
            ))}
          </div>
          <button onClick={() => setShowWallpaperPicker(!showWallpaperPicker)}
            className="mt-2 w-full flex items-center gap-2 bg-card rounded-xl border border-border/60 p-3 text-sm">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Custom image</span>
          </button>
          {showWallpaperPicker && (
            <div className="mt-2 bg-card rounded-xl border border-border/60 p-4">
              <label className="flex flex-col items-center gap-2 cursor-pointer">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Select image</span>
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

        {/* Privacy & Device */}
        <section>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2.5">Privacy</p>
          <div className="bg-card rounded-2xl border border-border/60 divide-y divide-border/40">
            {settingsItems.map((item) => (
              <div key={item.key} className="flex items-center gap-3 px-4 py-3">
                <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
                <Switch
                  checked={appSettings[item.key]}
                  onCheckedChange={(val) => {
                    updateSetting(item.key, val);
                    toast({ title: `${item.label} ${val ? "on" : "off"}` });
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Account */}
        <section className="pb-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2.5">Account</p>
          <p className="text-xs text-muted-foreground mb-2">{user?.email}</p>
          <button
            onClick={async () => { await supabase.auth.signOut(); }}
            className="w-full bg-card rounded-xl border border-border/60 p-3 text-sm text-destructive text-center">
            Sign Out
          </button>
        </section>
      </div>

      {/* Invite code dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="rounded-2xl max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="text-base">Your invite code</DialogTitle>
            <DialogDescription className="text-sm">Share this with your partner. Expires in 24 hours.</DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-xl p-4 text-center">
            <p className="text-2xl font-mono font-bold tracking-[0.3em]">{inviteCode}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={copyInviteLink} variant="outline" className="flex-1 rounded-full gap-2 text-sm h-9">
              <Copy className="h-3.5 w-3.5" /> Copy link
            </Button>
            <Button onClick={shareInviteLink} className="flex-1 rounded-full bg-foreground text-background gap-2 text-sm h-9">
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join code dialog */}
      <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
        <DialogContent className="rounded-2xl max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="text-base">Enter invite code</DialogTitle>
            <DialogDescription className="text-sm">Paste the code your partner shared with you.</DialogDescription>
          </DialogHeader>
          <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value)}
            placeholder="e.g. A1B2C3D4" className="rounded-xl text-center text-lg tracking-[0.2em] uppercase font-mono" />
          <DialogFooter>
            <Button onClick={acceptInvite} disabled={!joinCode.trim()} className="rounded-full bg-foreground text-background w-full h-9 text-sm">
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Settings;
