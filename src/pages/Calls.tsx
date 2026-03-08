import PageHeader from "@/components/PageHeader";
import { motion } from "framer-motion";
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed } from "lucide-react";

const callHistory = [
  { type: "outgoing", mode: "video", time: "Today, 3:45 PM", duration: "12 min" },
  { type: "incoming", mode: "voice", time: "Today, 1:20 PM", duration: "8 min" },
  { type: "missed", mode: "video", time: "Yesterday, 10:15 PM", duration: "" },
  { type: "outgoing", mode: "voice", time: "Yesterday, 6:00 PM", duration: "23 min" },
];

const callIcons = {
  outgoing: PhoneOutgoing,
  incoming: PhoneIncoming,
  missed: PhoneMissed,
};

const Calls = () => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <PageHeader title="Calls" subtitle="Stay connected" />

      <div className="px-5 space-y-6">
        {/* Quick call buttons */}
        <div className="flex gap-3">
          <button className="flex-1 bg-card rounded-2xl border border-border p-5 flex flex-col items-center gap-3 shadow-sm active:scale-[0.98] transition-transform">
            <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center">
              <Phone className="h-6 w-6 text-foreground" />
            </div>
            <span className="text-sm font-medium">Voice Call</span>
          </button>
          <button className="flex-1 bg-card rounded-2xl border border-border p-5 flex flex-col items-center gap-3 shadow-sm active:scale-[0.98] transition-transform">
            <div className="h-14 w-14 rounded-full bg-foreground flex items-center justify-center">
              <Video className="h-6 w-6 text-background" />
            </div>
            <span className="text-sm font-medium">Video Call</span>
          </button>
        </div>

        {/* Call history */}
        <div>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Recent</h2>
          <div className="space-y-1">
            {callHistory.map((call, i) => {
              const Icon = callIcons[call.type as keyof typeof callIcons];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <Icon className={`h-4 w-4 ${call.type === "missed" ? "text-destructive" : "text-muted-foreground"}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium flex items-center gap-2">
                      {call.mode === "video" ? "Video" : "Voice"} call
                      {call.type === "missed" && <span className="text-[10px] text-destructive">Missed</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{call.time}</p>
                  </div>
                  {call.duration && (
                    <span className="text-xs text-muted-foreground">{call.duration}</span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Calls;
