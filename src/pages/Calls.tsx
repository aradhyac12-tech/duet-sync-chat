import PageHeader from "@/components/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Wifi, Mic, MicOff, VideoIcon, VideoOff, PhoneOff, Maximize2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDailyCall } from "@/hooks/useDailyCall";
import { useToast } from "@/hooks/use-toast";

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

const qualityLabels: Record<NetworkQuality, { label: string; resolution: string; color: string }> = {
  excellent: { label: "Excellent", resolution: "1080p HD", color: "text-primary" },
  good: { label: "Good", resolution: "720p HD", color: "text-primary" },
  fair: { label: "Fair", resolution: "480p", color: "text-muted-foreground" },
  poor: { label: "Poor", resolution: "360p", color: "text-destructive" },
};

const Calls = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [browserNetworkQuality, setBrowserNetworkQuality] = useState<NetworkQuality>("good");
  const [isStartingCall, setIsStartingCall] = useState(false);

  const {
    joinCall, leaveCall, toggleAudio, toggleVideo,
    isAudioOn, isVideoOn, callState,
    localVideoRef, remoteVideoRef,
    networkQuality: callNetworkQuality, participantCount, error,
  } = useDailyCall();

  // Browser network quality detection
  useEffect(() => {
    const getQuality = (): NetworkQuality => {
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
    setBrowserNetworkQuality(getQuality());
    const nav = navigator as any;
    const handler = () => setBrowserNetworkQuality(getQuality());
    nav.connection?.addEventListener?.("change", handler);
    return () => nav.connection?.removeEventListener?.("change", handler);
  }, []);

  const activeQuality = callState === "joined" ? callNetworkQuality : browserNetworkQuality;
  const quality = qualityLabels[activeQuality];

  const startCall = async (mode: "video" | "voice") => {
    if (!user) return;
    setIsStartingCall(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("daily-call", {
        body: { action: "create-room", roomName: `duo-${user.id.slice(0, 8)}-${Date.now()}` },
      });

      if (fnError || data?.error) {
        throw new Error(data?.error || fnError?.message || "Failed to create room");
      }

      // Get a token
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke("daily-call", {
        body: { action: "get-token", roomName: data.name },
      });

      if (tokenError || tokenData?.error) {
        throw new Error(tokenData?.error || tokenError?.message || "Failed to get token");
      }

      await joinCall(data.url, tokenData.token);

      // If voice only, turn off video
      if (mode === "voice") {
        toggleVideo();
      }

      toast({ title: mode === "video" ? "Video call started 📹" : "Voice call started 📞" });
    } catch (err: any) {
      console.error("Start call error:", err);
      toast({ title: "Call failed", description: err.message, variant: "destructive" });
    }
    setIsStartingCall(false);
  };

  const endCall = () => {
    leaveCall();
    toast({ title: "Call ended" });
  };

  // In-call UI
  if (callState === "joined" || callState === "joining") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-screen bg-foreground relative">
        {/* Remote video (full screen) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* If no remote participant, show waiting */}
        {participantCount <= 1 && callState === "joined" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-background/80">
              <div className="h-20 w-20 rounded-full bg-background/10 flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
                <Phone className="h-8 w-8" />
              </div>
              <p className="text-lg font-serif">Waiting for partner...</p>
              <p className="text-sm opacity-60 mt-1">Share the call link</p>
            </div>
          </div>
        )}

        {callState === "joining" && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground">
            <div className="text-center text-background/80">
              <p className="text-lg font-serif animate-pulse-soft">Connecting...</p>
            </div>
          </div>
        )}

        {/* Local video (picture-in-picture) */}
        <motion.div
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          className="absolute top-14 right-4 w-28 h-40 rounded-2xl overflow-hidden shadow-lg border-2 border-background/20 z-10"
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!isVideoOn && (
            <div className="absolute inset-0 bg-foreground/80 flex items-center justify-center">
              <VideoOff className="h-6 w-6 text-background/60" />
            </div>
          )}
        </motion.div>

        {/* Network quality badge */}
        <div className="absolute top-4 left-4 z-10 bg-background/20 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-2">
          <Wifi className="h-3.5 w-3.5 text-background" />
          <span className="text-xs text-background font-medium">{quality.resolution}</span>
        </div>

        {/* Call controls */}
        <div className="absolute bottom-10 left-0 right-0 z-10 safe-bottom">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={toggleAudio}
              className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${
                isAudioOn ? "bg-background/20 backdrop-blur-md" : "bg-destructive"
              }`}
            >
              {isAudioOn ? <Mic className="h-6 w-6 text-background" /> : <MicOff className="h-6 w-6 text-background" />}
            </button>

            <button
              onClick={endCall}
              className="h-16 w-16 rounded-full bg-destructive flex items-center justify-center shadow-lg"
            >
              <PhoneOff className="h-7 w-7 text-background" />
            </button>

            <button
              onClick={toggleVideo}
              className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${
                isVideoOn ? "bg-background/20 backdrop-blur-md" : "bg-destructive"
              }`}
            >
              {isVideoOn ? <VideoIcon className="h-6 w-6 text-background" /> : <VideoOff className="h-6 w-6 text-background" />}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Default: call hub
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <PageHeader title="Calls" subtitle="Stay connected" />

      <div className="px-5 space-y-6 pb-24">
        {/* Error display */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Network quality indicator */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Wifi className={`h-5 w-5 ${quality.color}`} />
            <div className="flex-1">
              <p className="text-sm font-medium">Network: {quality.label}</p>
              <p className="text-[11px] text-muted-foreground">Auto quality: {quality.resolution}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-lg bg-muted ${quality.color}`}>
              {activeQuality === "excellent" ? "🟢" : activeQuality === "good" ? "🟡" : activeQuality === "fair" ? "🟠" : "🔴"}
            </span>
          </div>
        </div>

        {/* Quick call buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => startCall("voice")}
            disabled={isStartingCall}
            className="flex-1 bg-card rounded-2xl border border-border p-5 flex flex-col items-center gap-3 shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center">
              <Phone className="h-6 w-6 text-foreground" />
            </div>
            <span className="text-sm font-medium">{isStartingCall ? "Starting..." : "Voice Call"}</span>
          </button>
          <button
            onClick={() => startCall("video")}
            disabled={isStartingCall}
            className="flex-1 bg-card rounded-2xl border border-border p-5 flex flex-col items-center gap-3 shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            <div className="h-14 w-14 rounded-full bg-foreground flex items-center justify-center">
              <Video className="h-6 w-6 text-background" />
            </div>
            <div>
              <span className="text-sm font-medium block">{isStartingCall ? "Starting..." : "Video Call"}</span>
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
