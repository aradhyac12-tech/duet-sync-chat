import PageHeader from "@/components/PageHeader";
import { motion } from "framer-motion";
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Wifi, WifiOff } from "lucide-react";
import { useState, useEffect } from "react";

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

type NetworkQuality = "excellent" | "good" | "fair" | "poor";

const getNetworkQuality = (): NetworkQuality => {
  const nav = navigator as any;
  if (nav.connection) {
    const { downlink, effectiveType } = nav.connection;
    if (effectiveType === "4g" && downlink >= 10) return "excellent";
    if (effectiveType === "4g") return "good";
    if (effectiveType === "3g") return "fair";
    return "poor";
  }
  return "good";
};

const qualityLabels: Record<NetworkQuality, { label: string; resolution: string; color: string }> = {
  excellent: { label: "Excellent", resolution: "1080p HD", color: "text-primary" },
  good: { label: "Good", resolution: "720p HD", color: "text-primary" },
  fair: { label: "Fair", resolution: "480p", color: "text-muted-foreground" },
  poor: { label: "Poor", resolution: "360p", color: "text-destructive" },
};

const Calls = () => {
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>("good");

  useEffect(() => {
    setNetworkQuality(getNetworkQuality());
    const nav = navigator as any;
    const handler = () => setNetworkQuality(getNetworkQuality());
    nav.connection?.addEventListener?.("change", handler);
    return () => nav.connection?.removeEventListener?.("change", handler);
  }, []);

  const quality = qualityLabels[networkQuality];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <PageHeader title="Calls" subtitle="Stay connected" />

      <div className="px-5 space-y-6">
        {/* Network quality indicator */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Wifi className={`h-5 w-5 ${quality.color}`} />
            <div className="flex-1">
              <p className="text-sm font-medium">Network: {quality.label}</p>
              <p className="text-[11px] text-muted-foreground">Auto quality: {quality.resolution}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-lg bg-muted ${quality.color}`}>
              {networkQuality === "excellent" ? "🟢" : networkQuality === "good" ? "🟡" : networkQuality === "fair" ? "🟠" : "🔴"}
            </span>
          </div>
        </div>

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
            <div>
              <span className="text-sm font-medium block">Video Call</span>
              <span className="text-[10px] text-muted-foreground">{quality.resolution}</span>
            </div>
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
