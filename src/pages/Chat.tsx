import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, ImageIcon, FileText, Trash2, Camera, Mic, Play, Pause, Reply, Timer, TimerOff, Search, X, ChevronUp, ChevronDown, Phone, Video, MoreVertical, LayoutGrid, MicOff, VideoOff, PhoneOff, Monitor, MonitorOff, Wifi, Copy, Forward } from "lucide-react";
import MessageStatus from "@/components/chat/MessageStatus";
import MessageReactions from "@/components/chat/MessageReactions";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ReplyPreview from "@/components/chat/ReplyPreview";
import QuotedMessage from "@/components/chat/QuotedMessage";
import PhotoViewer from "@/components/chat/PhotoViewer";
import GridMenu from "@/components/chat/GridMenu";
import CallEvent from "@/components/chat/CallEvent";
import MessageContextMenu from "@/components/chat/MessageContextMenu";
import IncomingCallOverlay from "@/components/IncomingCallOverlay";
import { useState, useRef, useEffect, useCallback } from "react";
import { useLongPress } from "@/hooks/useLongPress";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { playMessageSound, playCallSound } from "@/lib/sounds";
import { hapticLight, hapticMedium, hapticMessageSent, hapticMessageReceived } from "@/lib/haptics";
import { useAuth } from "@/hooks/useAuth";
import { useE2E } from "@/hooks/useE2E";
import { useDailyCall } from "@/hooks/useDailyCall";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Message {
  id: string;
  content: string | null;
  sender_id: string;
  receiver_id: string;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  is_read: boolean;
  reply_to_id: string | null;
  disappear_at: string | null;
}

interface DecryptedMessage extends Message {
  decryptedContent: string | null;
}

interface CallEntry {
  id: string;
  caller_id: string;
  receiver_id: string | null;
  call_type: string;
  status: string;
  call_direction: string;
  duration_seconds: number | null;
  created_at: string;
}

type TimelineItem =
  | { type: "message"; data: DecryptedMessage }
  | { type: "call"; data: CallEntry };

const DISAPPEAR_DELAY_MS = 30000;

const formatCallDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const VoiceMessagePlayer = ({ src, isMine }: { src: string; isMine: boolean }) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => { setPlaying(false); setProgress(0); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause(); else audio.play();
    setPlaying(!playing);
  };

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2.5 min-w-[160px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button onClick={toggle} className="h-8 w-8 rounded-full bg-accent/60 flex items-center justify-center shrink-0 transition-colors hover:bg-accent">
        {playing ? <Pause className="h-3.5 w-3.5 text-foreground" /> : <Play className="h-3.5 w-3.5 text-foreground ml-0.5" />}
      </button>
      <div className="flex-1 space-y-1">
        <div className="h-[3px] bg-border rounded-full overflow-hidden">
          <div className="h-full bg-foreground/40 rounded-full transition-all" style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground">{fmt(progress > 0 ? progress : duration)}</p>
      </div>
    </div>
  );
};

const MessageBubble = ({ msg, isMine, isDisappearing, isHighlighted, isActiveResult, repliedMsg, partnerName, userId, onReply, onLongPress, onPhotoView, formatTime }: {
  msg: DecryptedMessage; isMine: boolean; isDisappearing: boolean; isHighlighted: boolean; isActiveResult: boolean;
  repliedMsg: DecryptedMessage | null; partnerName: string; userId: string;
  onReply: () => void; onLongPress: () => void; onPhotoView: (url: string) => void; formatTime: (iso: string) => string;
}) => {
  const longPressHandlers = useLongPress(onLongPress, 500);
  return (
    <motion.div id={`msg-${msg.id}`}
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: isDisappearing ? 0.6 : 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={`flex ${isMine ? "justify-end" : "justify-start"} group py-[2px] ${isActiveResult ? "ring-2 ring-primary rounded-2xl" : isHighlighted ? "ring-1 ring-primary/40 rounded-2xl" : ""}`}>
      <div className="flex items-end gap-1 max-w-[80%]" {...longPressHandlers}>
        {isMine && (
          <button onClick={onReply}
            className="h-6 w-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-foreground mb-1">
            <Reply className="h-3 w-3" />
          </button>
        )}
        <div className={`rounded-2xl px-3 py-2 select-none ${
          isMine ? "bg-foreground text-background rounded-br-md" : "bg-card border border-border/50 rounded-bl-md"
        } ${isDisappearing ? "ring-1 ring-primary/20" : ""}`}>
          {repliedMsg && (
            <QuotedMessage content={repliedMsg.decryptedContent || "Message"}
              senderName={repliedMsg.sender_id === userId ? "You" : partnerName} isMine={isMine} />
          )}
          {msg.message_type === "voice" && msg.file_url && <VoiceMessagePlayer src={msg.file_url} isMine={isMine} />}
          {msg.message_type === "image" && msg.file_url && (
            <img onClick={() => onPhotoView(msg.file_url!)} src={msg.file_url} alt="shared"
              className="rounded-xl mb-1 max-h-44 object-cover w-full cursor-pointer active:scale-[0.98] transition-transform" />
          )}
          {msg.message_type === "file" && msg.file_name && (
            <a href={msg.file_url || "#"} target="_blank" rel="noopener"
              className={`flex items-center gap-2 mb-1 rounded-lg px-2 py-1.5 ${isMine ? "bg-background/10" : "bg-muted/50"}`}>
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-50" />
              <span className="text-xs truncate">{msg.file_name}</span>
            </a>
          )}
          {msg.message_type !== "voice" && msg.decryptedContent && (
            <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.decryptedContent}</p>
          )}
          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? "justify-end" : ""}`}>
            {isDisappearing && <Timer className="h-2.5 w-2.5 opacity-30" />}
            <span className={`text-[10px] ${isMine ? "text-background/40" : "text-muted-foreground/60"}`}>{formatTime(msg.created_at)}</span>
            {isMine && <MessageStatus isRead={msg.is_read} isMine={isMine} />}
          </div>
          <MessageReactions messageId={msg.id} userId={userId} isMine={isMine} />
        </div>
        {!isMine && (
          <button onClick={onReply}
            className="h-6 w-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-foreground mb-1">
            <Reply className="h-3 w-3" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

const Chat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [callHistory, setCallHistory] = useState<CallEntry[]>([]);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showGridMenu, setShowGridMenu] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState("");
  const [partnerAvatar, setPartnerAvatar] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<DecryptedMessage | null>(null);
  const [disappearMode, setDisappearMode] = useState(false);
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { chatWallpaper } = useTheme();
  const { user } = useAuth();
  const { ready: e2eReady, encrypt, decrypt } = useE2E(user?.id, partnerId);
  const { toast } = useToast();
  const [contextMenuMsg, setContextMenuMsg] = useState<DecryptedMessage | null>(null);

  // Daily.co call state
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const {
    joinCall, leaveCall, toggleAudio, toggleVideo, toggleScreenShare,
    isAudioOn, isVideoOn, isScreenSharing, callState,
    localVideoRef, remoteVideoRef, screenShareRef,
    networkQuality: callNetworkQuality, participantCount, error: callError,
    callDuration,
  } = useDailyCall();

  const decryptMessages = useCallback(async (msgs: Message[]): Promise<DecryptedMessage[]> => {
    return Promise.all(
      msgs.map(async (msg) => ({
        ...msg,
        decryptedContent: msg.message_type === "text" ? await decrypt(msg.content) : msg.content,
      }))
    );
  }, [decrypt]);

  // Fetch partner info
  useEffect(() => {
    if (!user) return;
    const fetchPartner = async () => {
      const { data } = await supabase.from("profiles").select("partner_id").eq("user_id", user.id).single();
      if (data?.partner_id) {
        setPartnerId(data.partner_id);
        const { data: pp } = await supabase.from("profiles").select("display_name, avatar_url, pet_name").eq("user_id", data.partner_id).single();
        if (pp) {
          setPartnerName(pp.pet_name || pp.display_name || "Partner");
          setPartnerAvatar(pp.avatar_url);
        }
      }
    };
    fetchPartner();
  }, [user]);

  // Fetch messages
  useEffect(() => {
    if (!user || !partnerId) return;
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages").select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true }).limit(200);
      if (error) { console.error("Failed to fetch messages:", error); return; }
      if (data) {
        const now = new Date();
        const valid = (data as Message[]).filter(m => !m.disappear_at || new Date(m.disappear_at) > now);
        const decrypted = await decryptMessages(valid);
        setMessages(decrypted);
      }
    };
    fetchMessages();
  }, [user, partnerId, decryptMessages]);

  // Fetch call history
  useEffect(() => {
    if (!user || !partnerId) return;
    const fetchCalls = async () => {
      const { data } = await supabase
        .from("call_history").select("*")
        .or(`and(caller_id.eq.${user.id},receiver_id.eq.${partnerId}),and(caller_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true }).limit(200);
      if (data) setCallHistory(data as CallEntry[]);
    };
    fetchCalls();
    const channel = supabase
      .channel("call-history-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "call_history" }, () => fetchCalls())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, partnerId]);

  // Realtime messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === user.id || msg.receiver_id === user.id) {
          const decryptedContent = msg.message_type === "text" ? await decrypt(msg.content) : msg.content;
          setMessages((prev) => [...prev, { ...msg, decryptedContent }]);
          if (msg.sender_id !== user.id) playMessageSound();
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, () => {
        if (partnerId) {
          supabase.from("messages").select("*")
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
            .order("created_at", { ascending: true }).limit(200)
            .then(async ({ data }) => {
              if (data) { const decrypted = await decryptMessages(data as Message[]); setMessages(decrypted); }
            });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const updated = payload.new as Message;
        setMessages((prev) => prev.map((m) => m.id === updated.id ? { ...m, is_read: updated.is_read, disappear_at: updated.disappear_at } : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, partnerId, decrypt, decryptMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark incoming messages as read
  useEffect(() => {
    if (!user || !partnerId) return;
    const unread = messages.filter((m) => m.sender_id === partnerId && !m.is_read);
    if (unread.length === 0) return;
    const unreadIds = unread.map(m => m.id);
    const disappearAt = new Date(Date.now() + DISAPPEAR_DELAY_MS).toISOString();
    const disappearingIds = unread.filter(m => m.disappear_at === "pending").map(m => m.id);
    const normalIds = unreadIds.filter(id => !disappearingIds.includes(id));
    const runUpdates = async () => {
      if (normalIds.length > 0) await supabase.from("messages").update({ is_read: true }).in("id", normalIds);
      if (disappearingIds.length > 0) await supabase.from("messages").update({ is_read: true, disappear_at: disappearAt }).in("id", disappearingIds);
      setMessages((prev) =>
        prev.map((m) => {
          if (unreadIds.includes(m.id)) {
            return { ...m, is_read: true, disappear_at: disappearingIds.includes(m.id) ? disappearAt : m.disappear_at };
          }
          return m;
        })
      );
    };
    runUpdates();
  }, [messages, user, partnerId]);

  // Cleanup expired disappearing messages
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setMessages(prev => {
        const expired = prev.filter(m => m.disappear_at && m.disappear_at !== "pending" && new Date(m.disappear_at) <= now);
        if (expired.length > 0) supabase.from("messages").delete().in("id", expired.map(m => m.id));
        return prev.filter(m => !m.disappear_at || m.disappear_at === "pending" || new Date(m.disappear_at) > now);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Typing presence
  useEffect(() => {
    if (!user || !partnerId) return;
    const channelName = [user.id, partnerId].sort().join("-");
    const channel = supabase.channel(`typing-${channelName}`);
    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.user_id === partnerId) {
          setPartnerTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 2000);
        }
      })
      .subscribe();
    presenceChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [user, partnerId]);

  const broadcastTyping = useCallback(() => {
    if (!presenceChannelRef.current || !user) return;
    presenceChannelRef.current.send({ type: "broadcast", event: "typing", payload: { user_id: user.id } });
  }, [user]);

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        if (blob.size > 0) await sendVoiceMessage(blob);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      console.error("Microphone permission denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
  };

  const sendVoiceMessage = async (blob: Blob) => {
    if (!user || !partnerId) return;
    const ext = blob.type.includes("webm") ? "webm" : "m4a";
    const path = `${user.id}/${Date.now()}_voice.${ext}`;
    const { data: uploadData, error: uploadError } = await supabase.storage.from("chat-files").upload(path, blob, { contentType: blob.type });
    if (uploadError) { console.error("Upload failed:", uploadError); return; }
    if (!uploadData) return;
    const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id, receiver_id: partnerId, content: "🎤 Voice message",
      message_type: "voice", file_url: urlData.publicUrl, file_name: `voice.${ext}`,
      disappear_at: disappearMode ? "pending" : null,
    });
    if (error) console.error("Send voice failed:", error);
  };

  const handleSend = useCallback(async () => {
    if (!message.trim() || !user || !partnerId) return;
    const text = message;
    setMessage("");
    const currentReplyTo = replyTo;
    setReplyTo(null);
    const encryptedText = e2eReady ? await encrypt(text) : text;
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id, receiver_id: partnerId, content: encryptedText,
      message_type: "text", reply_to_id: currentReplyTo?.id || null,
      disappear_at: disappearMode ? "pending" : null,
    });
    if (error) console.error("Send message failed:", error);
  }, [message, user, partnerId, encrypt, e2eReady, replyTo, disappearMode]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => {
    const file = e.target.files?.[0];
    if (!file || !user || !partnerId) return;
    setShowAttach(false);
    const path = `${user.id}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage.from("chat-files").upload(path, file);
    if (uploadError) { console.error("Upload failed:", uploadError); return; }
    if (!uploadData) return;
    const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id, receiver_id: partnerId,
      content: type === "image" ? "📷 Photo" : `📎 ${file.name}`,
      message_type: type, file_url: urlData.publicUrl, file_name: file.name,
      disappear_at: disappearMode ? "pending" : null,
    });
    if (error) console.error("Send file failed:", error);
    e.target.value = "";
  };

  const clearChat = async () => {
    if (!user || !partnerId) return;
    await supabase.from("messages").delete()
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`);
    setMessages([]);
    setShowClearDialog(false);
  };

  // === Daily.co calling ===
  const startCall = async (mode: "video" | "voice") => {
    if (!user || !partnerId) return;
    setIsStartingCall(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === "video" });
      stream.getTracks().forEach(t => t.stop());
      playCallSound();

      const { data, error: fnError } = await supabase.functions.invoke("daily-call", {
        body: { action: "create-room", roomName: `duo-${user.id.slice(0, 8)}-${Date.now()}` },
      });
      if (fnError || data?.error) throw new Error(data?.error || fnError?.message || "Failed to create room");

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke("daily-call", {
        body: { action: "get-token", roomName: data.name },
      });
      if (tokenError || tokenData?.error) throw new Error(tokenData?.error || tokenError?.message || "Failed to get token");

      const { data: callRecord } = await supabase.from("call_history").insert({
        caller_id: user.id, receiver_id: partnerId, call_type: mode,
        call_direction: "outgoing", status: "in_progress", room_name: data.name,
        started_at: new Date().toISOString(),
      } as any).select().single();
      if (callRecord) setCurrentCallId((callRecord as any).id);

      await joinCall(data.url, tokenData.token);
      if (mode === "voice") toggleVideo();
      toast({ title: mode === "video" ? "Video call started" : "Voice call started" });
    } catch (err: any) {
      console.error("Start call error:", err);
      toast({ title: "Call failed", description: err.message, variant: "destructive" });
    }
    setIsStartingCall(false);
  };

  // Accept incoming call
  const handleAcceptIncoming = useCallback(async (roomName: string, callType: string) => {
    try {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke("daily-call", {
        body: { action: "get-token", roomName },
      });
      if (tokenError || tokenData?.error) throw new Error("Failed to get token");

      // Find the room URL from Daily
      const roomUrl = `https://${roomName.includes('.') ? '' : 'lovable.'}daily.co/${roomName}`;
      await joinCall(tokenData.url || roomUrl, tokenData.token);
      if (callType === "voice") toggleVideo();
      toast({ title: "Call connected" });
    } catch (err: any) {
      toast({ title: "Couldn't join call", description: err.message, variant: "destructive" });
    }
  }, [joinCall, toggleVideo, toast]);

  const handleDeclineIncoming = useCallback((_callId: string) => {
    toast({ title: "Call declined" });
  }, [toast]);

  const endCall = async () => {
    if (currentCallId && user) {
      await supabase.from("call_history").update({
        status: "completed", duration_seconds: callDuration, ended_at: new Date().toISOString(),
      } as any).eq("id", currentCallId);
      setCurrentCallId(null);
    }
    leaveCall();
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatRecTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Context menu actions
  const handleCopyMessage = useCallback(() => {
    if (contextMenuMsg?.decryptedContent) {
      navigator.clipboard.writeText(contextMenuMsg.decryptedContent);
      toast({ title: "Copied" });
    }
    setContextMenuMsg(null);
  }, [contextMenuMsg, toast]);

  const handleDeleteMessage = useCallback(async () => {
    if (!contextMenuMsg) return;
    await supabase.from("messages").delete().eq("id", contextMenuMsg.id);
    setMessages((prev) => prev.filter((m) => m.id !== contextMenuMsg.id));
    setContextMenuMsg(null);
    toast({ title: "Deleted" });
  }, [contextMenuMsg, toast]);

  const handleForwardMessage = useCallback(() => {
    if (contextMenuMsg?.decryptedContent) {
      navigator.clipboard.writeText(contextMenuMsg.decryptedContent);
      toast({ title: "Message copied to clipboard for forwarding" });
    }
    setContextMenuMsg(null);
  }, [contextMenuMsg, toast]);

  const handleReplyFromMenu = useCallback(() => {
    if (contextMenuMsg) {
      setReplyTo(contextMenuMsg);
      inputRef.current?.focus();
    }
    setContextMenuMsg(null);
  }, [contextMenuMsg]);

  // Search logic
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setSearchIndex(0); return; }
    const q = searchQuery.toLowerCase();
    const results = messages
      .filter(m => (m.decryptedContent && m.decryptedContent.toLowerCase().includes(q)) || (m.file_name && m.file_name.toLowerCase().includes(q)))
      .map(m => m.id);
    setSearchResults(results);
    setSearchIndex(results.length > 0 ? results.length - 1 : 0);
  }, [searchQuery, messages]);

  useEffect(() => {
    if (searchResults.length === 0) return;
    const id = searchResults[searchIndex];
    const el = document.getElementById(`msg-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [searchIndex, searchResults]);

  // Timeline
  const timeline: TimelineItem[] = [
    ...messages.map(m => ({ type: "message" as const, data: m })),
    ...callHistory.map(c => ({ type: "call" as const, data: c })),
  ].sort((a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime());

  const groupedTimeline: { date: string; items: TimelineItem[] }[] = [];
  timeline.forEach(item => {
    const date = new Date(item.data.created_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const last = groupedTimeline[groupedTimeline.length - 1];
    if (last?.date === date) last.items.push(item);
    else groupedTimeline.push({ date, items: [item] });
  });

  // === In-call fullscreen overlay ===
  if (callState === "joined" || callState === "joining") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-screen bg-[hsl(var(--foreground))] relative">
        <video ref={remoteVideoRef} autoPlay playsInline
          className={`absolute inset-0 w-full h-full object-cover ${isScreenSharing ? "hidden" : ""}`} />
        <video ref={screenShareRef} autoPlay playsInline
          className="absolute inset-0 w-full h-full object-contain bg-black" style={{ display: "none" }} />

        {participantCount <= 1 && callState === "joined" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-background">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="h-24 w-24 rounded-full bg-background/10 flex items-center justify-center mx-auto mb-5"
              >
                {partnerAvatar ? (
                  <img src={partnerAvatar} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <Phone className="h-10 w-10 text-background/60" />
                )}
              </motion.div>
              <p className="text-xl font-medium">{partnerName}</p>
              <p className="text-sm text-background/40 mt-1">Ringing...</p>
            </div>
          </div>
        )}

        {callState === "joining" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--foreground))]">
            <p className="text-lg font-medium animate-pulse text-background/60">Connecting...</p>
          </div>
        )}

        {/* Local video PiP */}
        <motion.div drag dragMomentum={false} dragElastic={0.1}
          className="absolute top-14 right-4 w-[100px] h-[140px] rounded-2xl overflow-hidden shadow-2xl border border-background/10 z-10 cursor-grab active:cursor-grabbing">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {!isVideoOn && (
            <div className="absolute inset-0 bg-muted flex items-center justify-center">
              <VideoOff className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </motion.div>

        {/* Call info bar */}
        <div className="absolute top-4 left-4 right-28 z-10 flex items-center gap-2 safe-top">
          <div className="bg-background/15 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${
              callNetworkQuality === "excellent" || callNetworkQuality === "good" ? "bg-green-400" :
              callNetworkQuality === "fair" ? "bg-yellow-400" : "bg-red-400"
            }`} />
            <span className="text-[11px] text-background/80 font-mono">{formatCallDuration(callDuration)}</span>
          </div>
          {isScreenSharing && (
            <div className="bg-primary/60 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1">
              <Monitor className="h-3 w-3 text-background" />
              <span className="text-[10px] text-background">Sharing</span>
            </div>
          )}
        </div>

        {/* Call controls */}
        <div className="absolute bottom-10 left-0 right-0 z-10 safe-bottom">
          <div className="flex items-center justify-center gap-4">
            <button onClick={toggleAudio}
              className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${isAudioOn ? "bg-background/15 backdrop-blur-md" : "bg-destructive"}`}>
              {isAudioOn ? <Mic className="h-5 w-5 text-background" /> : <MicOff className="h-5 w-5 text-background" />}
            </button>
            <button onClick={toggleVideo}
              className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${isVideoOn ? "bg-background/15 backdrop-blur-md" : "bg-destructive"}`}>
              {isVideoOn ? <Video className="h-5 w-5 text-background" /> : <VideoOff className="h-5 w-5 text-background" />}
            </button>
            <button onClick={toggleScreenShare}
              className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? "bg-primary" : "bg-background/15 backdrop-blur-md"}`}>
              {isScreenSharing ? <MonitorOff className="h-5 w-5 text-background" /> : <Monitor className="h-5 w-5 text-background" />}
            </button>
            <button onClick={endCall} className="h-14 w-14 rounded-full bg-destructive flex items-center justify-center shadow-lg">
              <PhoneOff className="h-6 w-6 text-background" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Incoming call overlay */}
      <IncomingCallOverlay onAccept={handleAcceptIncoming} onDecline={handleDeclineIncoming} />

      {/* Header */}
      <header className="safe-top px-4 pt-3 pb-2.5 bg-background border-b border-border/40 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {partnerAvatar ? (
                <img src={partnerAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] font-semibold text-muted-foreground">DS</span>
              )}
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight">
                {partnerId ? partnerName : "DuoSpace"}
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {partnerTyping ? "typing..." : e2eReady ? "end-to-end encrypted" : partnerId ? "online" : "Link a partner in settings"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => startCall("video")}
              disabled={isStartingCall || !partnerId}
              className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-30"
            >
              <Video className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={() => startCall("voice")}
              disabled={isStartingCall || !partnerId}
              className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-30"
            >
              <Phone className="h-[17px] w-[17px]" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                  <MoreVertical className="h-[18px] w-[18px]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50">
                <DropdownMenuItem onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(""); if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100); }}>
                  <Search className="h-4 w-4 mr-2.5" /> Search
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDisappearMode(!disappearMode)}>
                  {disappearMode ? <Timer className="h-4 w-4 mr-2.5" /> : <TimerOff className="h-4 w-4 mr-2.5" />}
                  {disappearMode ? "Disable disappearing" : "Disappearing messages"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowClearDialog(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2.5" /> Clear chat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
              <div className="flex items-center gap-2 mt-2 bg-muted/40 rounded-full px-3 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                {searchResults.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{searchIndex + 1}/{searchResults.length}</span>
                    <button onClick={() => setSearchIndex(i => Math.max(0, i - 1))} className="h-6 w-6 flex items-center justify-center text-muted-foreground"><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setSearchIndex(i => Math.min(searchResults.length - 1, i + 1))} className="h-6 w-6 flex items-center justify-center text-muted-foreground"><ChevronDown className="h-3.5 w-3.5" /></button>
                  </div>
                )}
                <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="h-6 w-6 flex items-center justify-center text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Disappearing mode banner */}
      <AnimatePresence>
        {disappearMode && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 py-1.5 bg-primary/5 flex items-center justify-center gap-1.5">
              <Timer className="h-3 w-3 text-primary" />
              <span className="text-[10px] text-primary font-medium">Messages disappear 30s after read</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3"
        style={chatWallpaper ? {
          backgroundImage: chatWallpaper.startsWith("url(") ? chatWallpaper : undefined,
          background: chatWallpaper.startsWith("linear") ? chatWallpaper : undefined,
          backgroundSize: "cover", backgroundPosition: "center",
        } : undefined}
      >
        {groupedTimeline.map((group) => (
          <div key={group.date}>
            <div className="flex justify-center my-3">
              <span className="text-[10px] text-muted-foreground bg-muted/50 backdrop-blur-sm px-3 py-1 rounded-full">{group.date}</span>
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                if (item.type === "call") {
                  const call = item.data;
                  return (
                    <CallEvent key={`call-${call.id}`} callType={call.call_type} status={call.status}
                      direction={call.call_direction} durationSeconds={call.duration_seconds}
                      createdAt={call.created_at} isMine={call.caller_id === user?.id} />
                  );
                }
                const msg = item.data;
                const repliedMsg = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : null;
                const isHighlighted = searchResults.includes(msg.id);
                const isActiveResult = searchResults[searchIndex] === msg.id;
                const isMine = msg.sender_id === user?.id;
                const isDisappearing = !!msg.disappear_at && msg.disappear_at !== "pending";
                return (
                  <MessageBubble key={msg.id} msg={msg} isMine={isMine} isDisappearing={isDisappearing}
                    isHighlighted={isHighlighted} isActiveResult={isActiveResult}
                    repliedMsg={repliedMsg} partnerName={partnerName} userId={user?.id || ""}
                    onReply={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                    onLongPress={() => setContextMenuMsg(msg)}
                    onPhotoView={(url) => setViewingPhoto(url)}
                    formatTime={formatTime}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <span className="text-xl">💬</span>
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-[200px]">
              {partnerId ? "Start your conversation" : "Link with your partner in settings"}
            </p>
          </div>
        )}

        <AnimatePresence>{partnerTyping && <TypingIndicator />}</AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Attach menu */}
      <AnimatePresence>
        {showAttach && !isRecording && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="px-4 pb-1 flex gap-2">
            <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-1.5 bg-muted/60 rounded-full px-3 py-2 text-xs">
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> Photo
            </button>
            <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-1.5 bg-muted/60 rounded-full px-3 py-2 text-xs">
              <Camera className="h-3.5 w-3.5 text-muted-foreground" /> Camera
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 bg-muted/60 rounded-full px-3 py-2 text-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" /> File
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <ReplyPreview replyToContent={replyTo.decryptedContent || "Message"}
            replyToSenderName={replyTo.sender_id === user?.id ? "You" : partnerName} onCancel={() => setReplyTo(null)} />
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="px-3 pb-3 pt-1.5 safe-bottom bg-background">
        {isRecording ? (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 bg-destructive/5 rounded-full border border-destructive/10 px-4 py-2.5">
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}
              className="h-2 w-2 rounded-full bg-destructive shrink-0" />
            <span className="text-sm font-medium text-destructive flex-1">{formatRecTime(recordingTime)}</span>
            <button onClick={cancelRecording} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button onClick={stopRecording} className="h-8 w-8 rounded-full bg-foreground flex items-center justify-center">
              <Send className="h-3.5 w-3.5 text-background" />
            </button>
          </motion.div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center gap-1 bg-muted/30 rounded-full border border-border/30 px-2 py-1">
              <button onClick={() => setShowAttach(!showAttach)}
                className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                <Paperclip className="h-4 w-4" />
              </button>
              <input ref={inputRef} type="text" value={message}
                onChange={(e) => { setMessage(e.target.value); broadcastTyping(); }}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={replyTo ? "Reply..." : "Message"}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 py-1.5" />
            </div>
            {message.trim() ? (
              <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} onClick={handleSend}
                className="h-10 w-10 rounded-full bg-foreground flex items-center justify-center shrink-0">
                <Send className="h-4 w-4 text-background" />
              </motion.button>
            ) : (
              <button
                onTouchStart={startRecording} onTouchEnd={stopRecording}
                onMouseDown={startRecording} onMouseUp={stopRecording}
                onMouseLeave={() => { if (isRecording) cancelRecording(); }}
                className="h-10 w-10 rounded-full bg-foreground flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                <Mic className="h-4 w-4 text-background" />
              </button>
            )}
            <button onClick={() => setShowGridMenu(true)}
              className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <input ref={imageInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFileSelect(e, "image")} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e, "file")} />

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="rounded-2xl max-w-[320px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold">Clear chat?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">All messages will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearChat} className="rounded-full bg-destructive text-destructive-foreground text-xs h-8">Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Overlays */}
      <AnimatePresence>{showGridMenu && <GridMenu onClose={() => setShowGridMenu(false)} />}</AnimatePresence>
      <AnimatePresence>{viewingPhoto && <PhotoViewer src={viewingPhoto} onClose={() => setViewingPhoto(null)} />}</AnimatePresence>
      <MessageContextMenu
        isOpen={!!contextMenuMsg}
        onClose={() => setContextMenuMsg(null)}
        onCopy={handleCopyMessage}
        onDelete={handleDeleteMessage}
        onForward={handleForwardMessage}
        onReply={handleReplyFromMenu}
        isMine={contextMenuMsg?.sender_id === user?.id}
        messageContent={contextMenuMsg?.decryptedContent || null}
      />
    </div>
  );
};

export default Chat;
