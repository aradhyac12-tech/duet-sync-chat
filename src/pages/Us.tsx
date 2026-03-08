import PageHeader from "@/components/PageHeader";
import { motion } from "framer-motion";
import { Smile, Timer, Zap, Star, HelpCircle, Flame } from "lucide-react";

const features = [
  { icon: Smile, label: "Mood Status", desc: "How are you feeling?", color: "bg-accent" },
  { icon: Timer, label: "Countdowns", desc: "Days until we meet", color: "bg-sand/50" },
  { icon: Zap, label: "Thinking of You", desc: "Send a gentle tap", color: "bg-accent" },
  { icon: Star, label: "Memory Wall", desc: "Our pinned moments", color: "bg-sand/50" },
  { icon: HelpCircle, label: "Daily Question", desc: "Today's prompt", color: "bg-accent" },
  { icon: Flame, label: "Streak", desc: "Keep it going", color: "bg-sand/50" },
];

const Us = () => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <PageHeader title="Us" subtitle="Our little world" />

      <div className="px-5 space-y-6">
        {/* Partner status */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-sand/50 flex items-center justify-center text-2xl">
              😊
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Her mood</p>
              <p className="text-xs text-muted-foreground">Feeling happy • 2h ago</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-serif">14</p>
              <p className="text-[10px] text-muted-foreground">day streak 🔥</p>
            </div>
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-3">
          {features.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.button
                key={feat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-card rounded-2xl border border-border p-4 text-left shadow-sm active:scale-[0.97] transition-transform"
              >
                <div className={`h-10 w-10 rounded-xl ${feat.color} flex items-center justify-center mb-3`}>
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <p className="text-sm font-medium">{feat.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{feat.desc}</p>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default Us;
