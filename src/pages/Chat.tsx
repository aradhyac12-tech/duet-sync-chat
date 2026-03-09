import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, ImageIcon, FileText, Trash2, Camera, Mic, Play, Pause, Reply, Timer, TimerOff, Search, X, ChevronUp, ChevronDown, Phone, Menu } from "lucide-react";
import MessageStatus from "@/components/chat/MessageStatus";
import MessageReactions from "@/components/chat/MessageReactions";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ReplyPreview from "@/components/chat/ReplyPreview";
import QuotedMessage from "@/components/chat/QuotedMessage";
import PhotoViewer from "@/components/chat/PhotoViewer";
import GridMenu from "@/components/chat/GridMenu";
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { playMessageSound, playCallSound } from "@/lib/sounds";
import { useAuth } from "@/hooks/useAuth";
import { useE2E } from "@/hooks/useE2E";
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

const DISAPPEAR_DELAY_MS = 30000; // 30 seconds after read

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

const Chat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
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
      if (error) {
        console.error("Failed to fetch messages:", error);
        return;
      }
      if (data) {
        // Filter out expired disappearing messages
        const now = new Date();
        const valid = (data as Message[]).filter(m => !m.disappear_at || new Date(m.disappear_at) > now);
        const decrypted = await decryptMessages(valid);
        setMessages(decrypted);
      }
    };
    fetchMessages();
  }, [user, partnerId, decryptMessages]);

  // Realtime
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

  // Mark incoming messages as read + set disappear_at
  useEffect(() => {
    if (!user || !partnerId) return;
    const unread = messages.filter((m) => m.sender_id === partnerId && !m.is_read);
    if (unread.length === 0) return;

    const unreadIds = unread.map(m => m.id);
    const disappearAt = new Date(Date.now() + DISAPPEAR_DELAY_MS).toISOString();

    // For messages that have disappear mode, set disappear_at
    const disappearingIds = unread.filter(m => m.disappear_at === "pending").map(m => m.id);
    const normalIds = unreadIds.filter(id => !disappearingIds.includes(id));

    const runUpdates = async () => {
      if (normalIds.length > 0) {
        await supabase.from("messages").update({ is_read: true }).in("id", normalIds);
      }
      if (disappearingIds.length > 0) {
        await supabase.from("messages").update({ is_read: true, disappear_at: disappearAt }).in("id", disappearingIds);
      }

      setMessages((prev) =>
        prev.map((m) => {
          if (unreadIds.includes(m.id)) {
            return {
              ...m,
              is_read: true,
              disappear_at: disappearingIds.includes(m.id) ? disappearAt : m.disappear_at,
            };
          }
          return m;
        })
      );
    };
    runUpdates();
  }, [messages, user, partnerId]);

  // Client-side cleanup of expired disappearing messages
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setMessages(prev => {
        const expired = prev.filter(m => m.disappear_at && m.disappear_at !== "pending" && new Date(m.disappear_at) <= now);
        if (expired.length > 0) {
          // Delete from DB
          supabase.from("messages").delete().in("id", expired.map(m => m.id));
        }
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
      sender_id: user.id,
      receiver_id: partnerId,
      content: "🎤 Voice message",
      message_type: "voice",
      file_url: urlData.publicUrl,
      file_name: `voice.${ext}`,
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
      sender_id: user.id,
      receiver_id: partnerId,
      content: encryptedText,
      message_type: "text",
      reply_to_id: currentReplyTo?.id || null,
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
      sender_id: user.id,
      receiver_id: partnerId,
      content: type === "image" ? "📷 Photo" : `📎 ${file.name}`,
      message_type: type,
      file_url: urlData.publicUrl,
      file_name: file.name,
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

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatRecTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchIndex(0);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = messages
      .filter(m => (m.decryptedContent && m.decryptedContent.toLowerCase().includes(q)) || (m.file_name && m.file_name.toLowerCase().includes(q)))
      .map(m => m.id);
    setSearchResults(results);
    setSearchIndex(results.length > 0 ? results.length - 1 : 0);
  }, [searchQuery, messages]);

  // Scroll to active search result
  useEffect(() => {
    if (searchResults.length === 0) return;
    const id = searchResults[searchIndex];
    const el = document.getElementById(`msg-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [searchIndex, searchResults]);

  // Group messages by date
  const groupedMessages: { date: string; msgs: DecryptedMessage[] }[] = [];
  messages.forEach(msg => {
    const date = new Date(msg.created_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const last = groupedMessages[groupedMessages.length - 1];
    if (last?.date === date) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date, msgs: [msg] });
    }
  });

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="safe-top px-4 pt-3 pb-2 bg-background/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowGridMenu(true)}
              className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center overflow-hidden">
              {partnerAvatar ? (
                <img src={partnerAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm">💕</span>
              )}
            </div>
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight text-foreground leading-tight">
                {partnerId ? partnerName : "DuoSpace"}
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {partnerTyping ? "typing..." : e2eReady ? "encrypted" : partnerId ? "connected" : "Link a partner to chat"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(""); if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100); }}
              className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={() => { playCallSound(); navigate("/calls"); }}
              className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDisappearMode(!disappearMode)}
              className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                disappearMode ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {disappearMode ? <Timer className="h-4 w-4" /> : <TimerOff className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setShowClearDialog(true)}
              className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 mt-2 bg-muted/50 rounded-full px-3 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {searchResults.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {searchIndex + 1}/{searchResults.length}
                    </span>
                    <button onClick={() => setSearchIndex(i => Math.max(0, i - 1))} className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setSearchIndex(i => Math.min(searchResults.length - 1, i + 1))} className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Disappearing mode banner */}
      <AnimatePresence>
        {disappearMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-1.5 bg-primary/5 flex items-center justify-center gap-1.5">
              <Timer className="h-3 w-3 text-primary" />
              <span className="text-[10px] text-primary font-medium">Messages will disappear 30s after being read</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3"
        style={chatWallpaper ? {
          backgroundImage: chatWallpaper.startsWith("url(") ? chatWallpaper : undefined,
          background: chatWallpaper.startsWith("linear") ? chatWallpaper : undefined,
          backgroundSize: "cover", backgroundPosition: "center",
        } : undefined}
      >
        {groupedMessages.map((group) => (
          <div key={group.date}>
            <div className="flex justify-center my-3">
              <span className="text-[10px] text-muted-foreground bg-muted/50 backdrop-blur-sm px-3 py-1 rounded-full">
                {group.date}
              </span>
            </div>
            <div className="space-y-1">
              {group.msgs.map((msg) => {
                const repliedMsg = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : null;
                const isHighlighted = searchResults.includes(msg.id);
                const isActiveResult = searchResults[searchIndex] === msg.id;
                const isMine = msg.sender_id === user?.id;
                const isDisappearing = !!msg.disappear_at && msg.disappear_at !== "pending";
                return (
                  <motion.div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: isDisappearing ? 0.7 : 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={`flex ${isMine ? "justify-end" : "justify-start"} group ${isActiveResult ? "ring-2 ring-primary rounded-2xl" : isHighlighted ? "ring-1 ring-primary/40 rounded-2xl" : ""}`}
                  >
                    <div className="flex items-end gap-1 max-w-[78%]">
                      {isMine && (
                        <button
                          onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                          className="h-6 w-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-foreground mb-1"
                        >
                          <Reply className="h-3 w-3" />
                        </button>
                      )}
                      <div className={`rounded-[18px] px-3.5 py-2 ${
                        isMine
                          ? "bg-foreground text-background rounded-br-[6px]"
                          : "bg-card border border-border/60 rounded-bl-[6px]"
                      } ${isDisappearing ? "ring-1 ring-primary/30" : ""}`}>
                        {repliedMsg && (
                          <QuotedMessage
                            content={repliedMsg.decryptedContent || "Message"}
                            senderName={repliedMsg.sender_id === user?.id ? "You" : partnerName}
                            isMine={isMine}
                          />
                        )}
                        {msg.message_type === "voice" && msg.file_url && (
                          <VoiceMessagePlayer src={msg.file_url} isMine={isMine} />
                        )}
                        {msg.message_type === "image" && msg.file_url && (
                          <img onClick={() => setViewingPhoto(msg.file_url!)} src={msg.file_url} alt="shared" className="rounded-xl mb-1.5 max-h-44 object-cover w-full cursor-pointer active:scale-[0.98] transition-transform" />
                        )}
                        {msg.message_type === "file" && msg.file_name && (
                          <a href={msg.file_url || "#"} target="_blank" rel="noopener"
                            className={`flex items-center gap-2 mb-1 rounded-lg px-2.5 py-1.5 ${isMine ? "bg-background/10" : "bg-muted/50"}`}>
                            <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
                            <span className="text-xs truncate">{msg.file_name}</span>
                          </a>
                        )}
                        {msg.message_type !== "voice" && msg.decryptedContent && (
                          <p className="text-[14px] leading-relaxed">{msg.decryptedContent}</p>
                        )}
                        <div className={`flex items-center gap-1 mt-0.5 ${isMine ? "justify-end" : ""}`}>
                          {isDisappearing && <Timer className="h-2.5 w-2.5 opacity-40" />}
                          <span className={`text-[10px] ${isMine ? "text-background/50" : "text-muted-foreground"}`}>
                            {formatTime(msg.created_at)}
                          </span>
                          {isMine && <MessageStatus isRead={msg.is_read} isMine={isMine} />}
                        </div>
                        <MessageReactions messageId={msg.id} userId={user?.id || ""} isMine={isMine} />
                      </div>
                      {!isMine && (
                        <button
                          onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                          className="h-6 w-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-foreground mb-1"
                        >
                          <Reply className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="h-16 w-16 rounded-full bg-accent/50 flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-[200px]">
              {partnerId ? "Start your conversation" : "Link with your partner in settings"}
            </p>
          </div>
        )}

        <AnimatePresence>
          {partnerTyping && <TypingIndicator />}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Attach menu */}
      <AnimatePresence>
        {showAttach && !isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="px-4 pb-1.5 flex gap-2"
          >
            <button onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-2 bg-card rounded-full border border-border/60 px-4 py-2 text-xs active:scale-[0.97] transition-transform">
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> Photo
            </button>
            <button onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-2 bg-card rounded-full border border-border/60 px-4 py-2 text-xs active:scale-[0.97] transition-transform">
              <Camera className="h-3.5 w-3.5 text-muted-foreground" /> Camera
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-card rounded-full border border-border/60 px-4 py-2 text-xs active:scale-[0.97] transition-transform">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" /> File
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <ReplyPreview
            replyToContent={replyTo.decryptedContent || "Message"}
            replyToSenderName={replyTo.sender_id === user?.id ? "You" : partnerName}
            onCancel={() => setReplyTo(null)}
          />
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="px-3 pb-20 pt-1.5">
        {isRecording ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 bg-destructive/8 rounded-full border border-destructive/15 px-4 py-2.5"
          >
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}
              className="h-2.5 w-2.5 rounded-full bg-destructive shrink-0" />
            <span className="text-sm font-medium text-destructive flex-1">{formatRecTime(recordingTime)}</span>
            <button onClick={cancelRecording} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button onClick={stopRecording} className="h-8 w-8 rounded-full bg-foreground flex items-center justify-center">
              <Send className="h-3.5 w-3.5 text-background" />
            </button>
          </motion.div>
        ) : (
          <div className="flex items-center gap-1.5 bg-card/80 backdrop-blur-sm rounded-full border border-border/50 px-2 py-1.5 shadow-sm">
            <button onClick={() => setShowAttach(!showAttach)}
              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground transition-colors">
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => { setMessage(e.target.value); broadcastTyping(); }}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={replyTo ? "Reply..." : "Message"}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground py-1"
            />
            {message.trim() ? (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                onClick={handleSend}
                className="h-8 w-8 rounded-full bg-foreground flex items-center justify-center shrink-0"
              >
                <Send className="h-3.5 w-3.5 text-background" />
              </motion.button>
            ) : (
              <button
                onTouchStart={startRecording} onTouchEnd={stopRecording}
                onMouseDown={startRecording} onMouseUp={stopRecording}
                onMouseLeave={() => { if (isRecording) cancelRecording(); }}
                className="h-8 w-8 rounded-full bg-foreground flex items-center justify-center shrink-0 active:scale-95 transition-transform"
              >
                <Mic className="h-3.5 w-3.5 text-background" />
              </button>
            )}
          </div>
        )}
      </div>

      <input ref={imageInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFileSelect(e, "image")} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e, "file")} />

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="rounded-2xl max-w-[320px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Clear chat?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">All messages will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full text-sm h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearChat} className="rounded-full bg-destructive text-destructive-foreground text-sm h-9">Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Overlays */}
      <AnimatePresence>
        {showGridMenu && <GridMenu onClose={() => setShowGridMenu(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {viewingPhoto && <PhotoViewer src={viewingPhoto} onClose={() => setViewingPhoto(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default Chat;
