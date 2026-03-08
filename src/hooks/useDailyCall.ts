import { useCallback, useEffect, useRef, useState } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";

type NetworkQuality = "excellent" | "good" | "fair" | "poor";

interface UseDailyCallReturn {
  joinCall: (url: string, token?: string) => Promise<void>;
  leaveCall: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  isAudioOn: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  callState: "idle" | "joining" | "joined" | "error";
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  screenShareRef: React.RefObject<HTMLVideoElement>;
  networkQuality: NetworkQuality;
  participantCount: number;
  error: string | null;
  callDuration: number;
}

export const useDailyCall = (): UseDailyCallReturn => {
  const [callState, setCallState] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>("good");
  const [participantCount, setParticipantCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const callRef = useRef<DailyCall | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null!);
  const remoteVideoRef = useRef<HTMLVideoElement>(null!);
  const screenShareRef = useRef<HTMLVideoElement>(null!);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setCallDuration(0);

      const call = DailyIframe.createCallObject({
        subscribeToTracksAutomatically: true,
      });

      callRef.current = call;

      call.on("joined-meeting", () => {
        setCallState("joined");
        const local = call.participants().local;
        attachTrack(local, localVideoRef);
        // Start duration timer
        timerRef.current = setInterval(() => {
          setCallDuration((d) => d + 1);
        }, 1000);
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
            // Check if it's a screenShare track
            if (evt.participant.tracks?.screenVideo?.persistentTrack === evt.track) {
              if (screenShareRef.current) {
                screenShareRef.current.srcObject = new MediaStream([evt.track]);
              }
            } else {
              attachTrack(evt.participant, remoteVideoRef);
            }
          } else if (evt.track?.kind === "audio") {
            attachAudioTrack(evt.participant);
          }
        } else if (evt?.participant?.local && evt.track?.kind === "video") {
          attachTrack(evt.participant, localVideoRef);
        }
      });

      call.on("track-stopped", (evt: any) => {
        if (evt?.participant && !evt.participant.local && evt.track?.kind === "video") {
          if (screenShareRef.current && screenShareRef.current.srcObject) {
            const stream = screenShareRef.current.srcObject as MediaStream;
            const tracks = stream.getTracks();
            if (tracks.some((t) => t.id === evt.track.id)) {
              screenShareRef.current.srcObject = null;
            }
          }
        }
      });

      call.on("participant-left", () => {
        setParticipantCount(Object.keys(call.participants()).length);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        if (screenShareRef.current) screenShareRef.current.srcObject = null;
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
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (callRef.current) {
      callRef.current.leave();
      callRef.current.destroy();
      callRef.current = null;
    }
    setCallState("idle");
    setParticipantCount(0);
    setIsScreenSharing(false);
    setCallDuration(0);
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (screenShareRef.current) screenShareRef.current.srcObject = null;
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

  const toggleScreenShare = useCallback(async () => {
    if (!callRef.current) return;
    try {
      if (isScreenSharing) {
        await callRef.current.stopScreenShare();
        setIsScreenSharing(false);
      } else {
        await callRef.current.startScreenShare();
        setIsScreenSharing(true);
      }
    } catch (err) {
      console.error("Screen share error:", err);
      // User cancelled the screen share picker
      setIsScreenSharing(false);
    }
  }, [isScreenSharing]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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
    toggleScreenShare,
    isAudioOn,
    isVideoOn,
    isScreenSharing,
    callState,
    localVideoRef,
    remoteVideoRef,
    screenShareRef,
    networkQuality,
    participantCount,
    error,
    callDuration,
  };
};
