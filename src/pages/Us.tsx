import PageHeader from "@/components/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import { Smile, Timer, Zap, HelpCircle, Flame, Plus, X, Send, Settings } from "lucide-react";
import MemoryWall from "@/components/MemoryWall";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const dailyQuestions = [
  "What made you smile today?",
  "What's one thing you love about us?",
  "Describe your perfect day together.",
  "What song reminds you of me?",
  "What's a dream trip you'd take together?",
  "What's your favourite memory of us?",
  "If we could do anything right now, what would it be?",
];

const getQuestionOfDay = () => {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return dailyQuestions[dayOfYear % dailyQuestions.length];
};

const Us = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [countdowns, setCountdowns] = useState<any[]>([]);
  const [showCountdownDialog, setShowCountdownDialog] = useState(false);
  const [newCountdown, setNewCountdown] = useState({ title: "", date: "", emoji: "🎉" });
  const [dailyAnswer, setDailyAnswer] = useState("");
  const [myAnswer, setMyAnswer] = useState<string | null>(null);
  const [partnerAnswer, setPartnerAnswer] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [moodEmoji, setMoodEmoji] = useState("😊");
  const [moodText, setMoodText] = useState("");
  const [showMoodDialog, setShowMoodDialog] = useState(false);

  const todayQuestion = getQuestionOfDay();

  // Fetch profiles & data
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      if (p) {
        setProfile(p);
        setMoodEmoji(p.mood_emoji || "😊");
        setMoodText(p.mood_text || "");
        if (p.partner_id) {
          const { data: pp } = await supabase.from("profiles").select("*").eq("user_id", p.partner_id).single();
          if (pp) setPartnerProfile(pp);
        }
      }

      const { data: cd } = await supabase.from("countdowns").select("*").order("target_date", { ascending: true });
      if (cd) setCountdowns(cd);

      // Daily answers
      const today = new Date().toISOString().split("T")[0];
      const { data: myA } = await supabase.from("daily_answers").select("answer").eq("user_id", user.id).eq("question_date", today).single();
      if (myA) setMyAnswer(myA.answer);

      if (p?.partner_id) {
        const { data: pA } = await supabase.from("daily_answers").select("answer").eq("user_id", p.partner_id).eq("question_date", today).single();
        if (pA) setPartnerAnswer(pA.answer);
      }

      // Calculate streak: count consecutive days where BOTH users had any interaction
      // Interactions = messages sent, taps, daily answers, gallery uploads
      const today2 = new Date();
      let s = 0;
      
      // Get all message dates for this user
      const { data: myMsgs } = await supabase.from("messages").select("created_at")
        .eq("sender_id", user.id).order("created_at", { ascending: false }).limit(500);
      
      // Get partner messages
      const { data: partnerMsgs } = p?.partner_id 
        ? await supabase.from("messages").select("created_at")
            .eq("sender_id", p.partner_id).order("created_at", { ascending: false }).limit(500)
        : { data: [] };

      // Get taps
      const { data: myTaps } = await supabase.from("taps").select("created_at")
        .eq("sender_id", user.id).order("created_at", { ascending: false }).limit(100);

      // Get daily answers
      const { data: myAnswers } = await supabase.from("daily_answers").select("created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);

      // Combine all interaction timestamps
      const allDates = [
        ...(myMsgs || []).map(m => m.created_at),
        ...(partnerMsgs || []).map(m => m.created_at),
        ...(myTaps || []).map(t => t.created_at),
        ...(myAnswers || []).map(a => a.created_at),
      ];

      for (let i = 0; i < 365; i++) {
        const d = new Date(today2);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const hasInteraction = allDates.some((ts) => ts.startsWith(dateStr));
        if (hasInteraction) s++;
        else if (i > 0) break;
      }
      setStreak(s);
    };
    load();
  }, [user]);

  const updateMood = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ mood_emoji: moodEmoji, mood_text: moodText, mood_updated_at: new Date().toISOString() }).eq("user_id", user.id);
    setProfile((p: any) => ({ ...p, mood_emoji: moodEmoji, mood_text: moodText }));
    setShowMoodDialog(false);
    toast({ title: "Mood updated ✨" });
  };

  const sendTap = async () => {
    if (!user) return;
    await supabase.from("taps").insert({ sender_id: user.id });
    toast({ title: "Sent! 💫", description: "They'll feel it" });
  };

  const addCountdown = async () => {
    if (!user || !newCountdown.title || !newCountdown.date) return;
    const { data } = await supabase.from("countdowns").insert({
      creator_id: user.id,
      title: newCountdown.title,
      target_date: newCountdown.date,
      emoji: newCountdown.emoji,
    }).select().single();
    if (data) setCountdowns((prev) => [...prev, data]);
    setShowCountdownDialog(false);
    setNewCountdown({ title: "", date: "", emoji: "🎉" });
  };

  const submitDailyAnswer = async () => {
    if (!user || !dailyAnswer.trim()) return;
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("daily_answers").insert({ user_id: user.id, question: todayQuestion, answer: dailyAnswer, question_date: today });
    setMyAnswer(dailyAnswer);
    setDailyAnswer("");
  };

  const daysUntil = (date: string) => {
    const diff = new Date(date).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  };

  const moodTime = partnerProfile?.mood_updated_at
    ? `${Math.round((Date.now() - new Date(partnerProfile.mood_updated_at).getTime()) / 3600000)}h ago`
    : "";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-24">
      <PageHeader title="Us" subtitle="Our little world">
        <button onClick={() => navigate("/settings")} className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center">
          <Settings className="h-4 w-4 text-foreground" />
        </button>
      </PageHeader>

      <div className="px-5 space-y-5">
        {/* Partner mood + streak */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setShowMoodDialog(true)} className="h-14 w-14 rounded-full bg-sand/50 flex items-center justify-center text-2xl shrink-0">
              {partnerProfile?.mood_emoji || "😊"}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{partnerProfile?.display_name || "Partner"}</p>
              <p className="text-xs text-muted-foreground truncate">
                {partnerProfile?.mood_text || "No mood set"} • {moodTime}
              </p>
            </div>
            <div className="text-center shrink-0">
              <p className="text-2xl font-serif">{streak}</p>
              <p className="text-[10px] text-muted-foreground">day streak 🔥</p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowMoodDialog(true)}
            className="bg-card rounded-2xl border border-border p-4 text-left shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center mb-3">
              <Smile className="h-5 w-5 text-foreground" />
            </div>
            <p className="text-sm font-medium">My Mood</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{profile?.mood_emoji} {profile?.mood_text || "Set mood"}</p>
          </motion.button>

          <motion.button whileTap={{ scale: 0.95 }} onClick={sendTap}
            className="bg-card rounded-2xl border border-border p-4 text-left shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-sand/50 flex items-center justify-center mb-3">
              <Zap className="h-5 w-5 text-foreground" />
            </div>
            <p className="text-sm font-medium">Thinking of You</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Send a gentle tap 💫</p>
          </motion.button>
        </div>

        {/* Countdowns */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Countdowns</h2>
            <button onClick={() => setShowCountdownDialog(true)} className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {countdowns.length === 0 ? (
            <p className="text-xs text-muted-foreground">No countdowns yet. Add one!</p>
          ) : (
            <div className="space-y-2">
              {countdowns.map((cd) => (
                <div key={cd.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                  <span className="text-xl">{cd.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{cd.title}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(cd.target_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-serif">{daysUntil(cd.target_date)}</p>
                    <p className="text-[10px] text-muted-foreground">days</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Daily question */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Today's Question</h2>
          <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-3">
            <p className="text-sm font-medium font-serif">{todayQuestion}</p>
            {myAnswer ? (
              <div className="bg-primary/10 rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground mb-1">You</p>
                <p className="text-sm">{myAnswer}</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input value={dailyAnswer} onChange={(e) => setDailyAnswer(e.target.value)}
                  placeholder="Your answer..." className="h-10 rounded-xl text-sm" />
                <Button onClick={submitDailyAnswer} size="icon" className="h-10 w-10 rounded-xl bg-foreground shrink-0">
                  <Send className="h-4 w-4 text-background" />
                </Button>
              </div>
            )}
            {partnerAnswer && (
              <div className="bg-sand/30 rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground mb-1">{partnerProfile?.display_name || "Partner"}</p>
                <p className="text-sm">{partnerAnswer}</p>
              </div>
            )}
          </div>
        </section>

        <MemoryWall />
      </div>

      {/* Mood dialog */}
      <Dialog open={showMoodDialog} onOpenChange={setShowMoodDialog}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Set your mood</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {["😊", "😍", "🥰", "😴", "😢", "🤗", "😤", "🥳", "😌", "🫠", "💪", "✨"].map((e) => (
                <button key={e} onClick={() => setMoodEmoji(e)}
                  className={`text-2xl p-2 rounded-xl ${moodEmoji === e ? "bg-accent" : "hover:bg-muted"}`}>
                  {e}
                </button>
              ))}
            </div>
            <Input value={moodText} onChange={(e) => setMoodText(e.target.value)}
              placeholder="How are you feeling?" className="rounded-xl" />
          </div>
          <DialogFooter>
            <Button onClick={updateMood} className="rounded-xl bg-foreground text-background w-full">Save Mood</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Countdown dialog */}
      <Dialog open={showCountdownDialog} onOpenChange={setShowCountdownDialog}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>New Countdown</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={newCountdown.title} onChange={(e) => setNewCountdown({ ...newCountdown, title: e.target.value })}
              placeholder="Event name" className="rounded-xl" />
            <Input type="date" value={newCountdown.date} onChange={(e) => setNewCountdown({ ...newCountdown, date: e.target.value })}
              className="rounded-xl" />
            <div className="flex gap-2">
              {["🎉", "❤️", "✈️", "🎂", "💍", "🏖️"].map((e) => (
                <button key={e} onClick={() => setNewCountdown({ ...newCountdown, emoji: e })}
                  className={`text-xl p-2 rounded-xl ${newCountdown.emoji === e ? "bg-accent" : "hover:bg-muted"}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addCountdown} className="rounded-xl bg-foreground text-background w-full">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Us;
