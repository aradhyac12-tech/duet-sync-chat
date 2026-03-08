import { useCallback, useEffect, useRef, useState } from "react";
import DailyIframe, { DailyCall, DailyEventObjectParticipant } from "@daily-co/daily-js";

type NetworkQuality = "excellent" | "good" | "fair" | "poor";

interface UseDailyCallReturn {
  joinCall: (url: string, token?: string) => Promise<void>;
  leaveCall: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  isAudioOn: boolean;
  isVideoOn: boolean;
  callState: "idle" | "joining" | "joined" | "error";
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  networkQuality: NetworkQuality;
  participantCount: number;
  error: string | null;
}

export const useDailyCall = (): UseDailyCallReturn => {
  const [callState, setCallState] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>("good");
  const [participantCount, setParticipantCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const callRef = useRef<DailyCall | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null!);
  const remoteVideoRef = useRef<HTMLVideoElement>(null!);

  const attachTrack = useCallback((participant: any, ref: React.RefObject<HTMLVideoElement>) => {
    if (!ref.current) return;
    const track = participant?.tracks?.video?.persistentTrack;
    if (track) {
      ref.current.srcObject = new MediaStream([track]);
    }
  }, []);

  const attachAudioTrack = useCallback((participant: any) => {
    const track = participant?.tracks?.audio?.persistentTrack;
    if (track) {
      const audio = new Audio();
      audio.srcObject = new MediaStream([track]);
      audio.play().catch(() => {});
    }
  }, []);

  const joinCall = useCallback(async (url: string, token?: string) => {
    try {
      setCallState("joining");
      setError(null);

      const call = DailyIframe.createCallObject({
        subscribeToTracksAutomatically: true,
      });

      callRef.current = call;

      call.on("joined-meeting", () => {
        setCallState("joined");
        const local = call.participants().local;
        attachTrack(local, localVideoRef);
      });

      call.on("participant-joined", (evt) => {
        if (evt?.participant) {
          attachTrack(evt.participant, remoteVideoRef);
          attachAudioTrack(evt.participant);
        }
        setParticipantCount(Object.keys(call.participants()).length);
      });

      call.on("track-started", (evt: any) => {
        if (evt?.participant && !evt.participant.local) {
          if (evt.track?.kind === "video") {
            attachTrack(evt.participant, remoteVideoRef);
          } else if (evt.track?.kind === "audio") {
            attachAudioTrack(evt.participant);
          }
        } else if (evt?.participant?.local && evt.track?.kind === "video") {
          attachTrack(evt.participant, localVideoRef);
        }
      });

      call.on("participant-left", () => {
        setParticipantCount(Object.keys(call.participants()).length);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      });

      call.on("network-quality-change", (evt: any) => {
        const quality = evt?.threshold;
        if (quality === "good") setNetworkQuality("excellent");
        else if (quality === "low") setNetworkQuality("fair");
        else if (quality === "very-low") setNetworkQuality("poor");
        else setNetworkQuality("good");
      });

      call.on("error", (evt: any) => {
        console.error("Daily error:", evt);
        setError(evt?.errorMsg || "Call error");
        setCallState("error");
      });

      const joinOptions: any = { url };
      if (token) joinOptions.token = token;

      await call.join(joinOptions);
      setParticipantCount(Object.keys(call.participants()).length);

    } catch (err: any) {
      console.error("Join error:", err);
      setError(err.message || "Failed to join call");
      setCallState("error");
    }
  }, [attachTrack, attachAudioTrack]);

  const leaveCall = useCallback(() => {
    if (callRef.current) {
      callRef.current.leave();
      callRef.current.destroy();
      callRef.current = null;
    }
    setCallState("idle");
    setParticipantCount(0);
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const toggleAudio = useCallback(() => {
    if (callRef.current) {
      callRef.current.setLocalAudio(!isAudioOn);
      setIsAudioOn(!isAudioOn);
    }
  }, [isAudioOn]);

  const toggleVideo = useCallback(() => {
    if (callRef.current) {
      callRef.current.setLocalVideo(!isVideoOn);
      setIsVideoOn(!isVideoOn);
    }
  }, [isVideoOn]);

  useEffect(() => {
    return () => {
      if (callRef.current) {
        callRef.current.leave();
        callRef.current.destroy();
      }
    };
  }, []);

  return {
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
    isAudioOn,
    isVideoOn,
    callState,
    localVideoRef,
    remoteVideoRef,
    networkQuality,
    participantCount,
    error,
  };
};
