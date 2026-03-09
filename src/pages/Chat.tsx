import PageHeader from "@/components/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, ImageIcon, FileText, Trash2, MoreVertical, Camera, Shield, Mic, Square, Play, Pause } from "lucide-react";
import MessageStatus from "@/components/chat/MessageStatus";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useE2E } from "@/hooks/useE2E";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
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
}

interface DecryptedMessage extends Message {
  decryptedContent: string | null;
}

// Audio player component for voice messages
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
    if (playing) { audio.pause(); } else { audio.play(); }
    setPlaying(!playing);
  };

  const formatDur = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button onClick={toggle} className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isMine ? "bg-primary/30" : "bg-accent"}`}>
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      <div className="flex-1 space-y-1">
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-foreground/50 rounded-full transition-all" style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground">{formatDur(progress > 0 ? progress : duration)}</p>
      </div>
    </div>
  );
};

const Chat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
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

  useEffect(() => {
    if (!user) return;
    const fetchPartner = async () => {
      const { data } = await supabase.from("profiles").select("partner_id").eq("user_id", user.id).single();
      if (data?.partner_id) setPartnerId(data.partner_id);
    };
    fetchPartner();
  }, [user]);

  useEffect(() => {
    if (!user || !partnerId) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages").select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true }).limit(200);
      if (data) {
        const decrypted = await decryptMessages(data);
        setMessages(decrypted);
      }
    };
    fetchMessages();
  }, [user, partnerId, decryptMessages]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === user.id || msg.receiver_id === user.id) {
          const decryptedContent = msg.message_type === "text" ? await decrypt(msg.content) : msg.content;
          setMessages((prev) => [...prev, { ...msg, decryptedContent }]);
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, () => {
        if (partnerId) {
          supabase.from("messages").select("*")
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
            .order("created_at", { ascending: true }).limit(200)
            .then(async ({ data }) => {
              if (data) { const decrypted = await decryptMessages(data); setMessages(decrypted); }
            });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const updated = payload.new as Message;
        setMessages((prev) => prev.map((m) => m.id === updated.id ? { ...m, is_read: updated.is_read } : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, partnerId, decrypt, decryptMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark incoming messages as read
  useEffect(() => {
    if (!user || !partnerId) return;
    const unreadIds = messages
      .filter((m) => m.sender_id === partnerId && !m.is_read)
      .map((m) => m.id);
    if (unreadIds.length === 0) return;
    supabase
      .from("messages")
      .update({ is_read: true })
      .in("id", unreadIds)
      .then(() => {
        setMessages((prev) =>
          prev.map((m) => (unreadIds.includes(m.id) ? { ...m, is_read: true } : m))
        );
      });
  }, [messages, user, partnerId]);

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
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
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const sendVoiceMessage = async (blob: Blob) => {
    if (!user || !partnerId) return;
    const ext = blob.type.includes("webm") ? "webm" : "m4a";
    const path = `${user.id}/${Date.now()}_voice.${ext}`;
    const { data: uploadData } = await supabase.storage.from("chat-files").upload(path, blob, { contentType: blob.type });
    if (!uploadData) return;
    const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: partnerId,
      content: "🎤 Voice message",
      message_type: "voice",
      file_url: urlData.publicUrl,
      file_name: `voice.${ext}`,
    });
  };

  const handleSend = useCallback(async () => {
    if (!message.trim() || !user || !partnerId) return;
    const text = message;
    setMessage("");
    const encryptedText = e2eReady ? await encrypt(text) : text;
    await supabase.from("messages").insert({
      sender_id: user.id, receiver_id: partnerId, content: encryptedText, message_type: "text",
    });
  }, [message, user, partnerId, encrypt, e2eReady]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => {
    const file = e.target.files?.[0];
    if (!file || !user || !partnerId) return;
    setShowAttach(false);
    const path = `${user.id}/${Date.now()}_${file.name}`;
    const { data: uploadData } = await supabase.storage.from("chat-files").upload(path, file);
    if (!uploadData) return;
    const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
    await supabase.from("messages").insert({
      sender_id: user.id, receiver_id: partnerId,
      content: type === "image" ? "📷 Photo" : `📎 ${file.name}`,
      message_type: type, file_url: urlData.publicUrl, file_name: file.name,
    });
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-screen">
      <PageHeader title="Chat" subtitle={partnerId ? (e2eReady ? "🔒 End-to-end encrypted" : "Connected") : "Set a partner in settings"}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center">
              <MoreVertical className="h-4 w-4 text-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuItem onClick={() => setShowClearDialog(true)} className="text-destructive gap-2">
              <Trash2 className="h-4 w-4" /> Clear chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      {e2eReady && (
        <div className="px-5 py-1.5 flex items-center justify-center gap-1.5 bg-primary/5">
          <Shield className="h-3 w-3 text-primary" />
          <span className="text-[10px] text-primary font-medium">Messages are end-to-end encrypted</span>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
        style={chatWallpaper ? {
          backgroundImage: chatWallpaper.startsWith("url(") ? chatWallpaper : undefined,
          background: chatWallpaper.startsWith("linear") ? chatWallpaper : undefined,
          backgroundSize: "cover", backgroundPosition: "center",
        } : undefined}
      >
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"}`}
            >
              <div className={`rounded-2xl px-4 py-2.5 max-w-[75%] ${
                msg.sender_id === user?.id ? "bg-primary/20 rounded-br-md" : "bg-card rounded-bl-md shadow-sm border border-border"
              }`}>
                {msg.message_type === "voice" && msg.file_url && (
                  <VoiceMessagePlayer src={msg.file_url} isMine={msg.sender_id === user?.id} />
                )}
                {msg.message_type === "image" && msg.file_url && (
                  <img src={msg.file_url} alt="shared" className="rounded-lg mb-2 max-h-48 object-cover w-full" />
                )}
                {msg.message_type === "file" && msg.file_name && (
                  <a href={msg.file_url || "#"} target="_blank" rel="noopener"
                    className="flex items-center gap-2 mb-1 bg-muted/50 rounded-lg px-3 py-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate">{msg.file_name}</span>
                  </a>
                )}
                {msg.message_type !== "voice" && msg.decryptedContent && <p className="text-sm">{msg.decryptedContent}</p>}
                <span className={`text-[10px] text-muted-foreground mt-1 flex items-center gap-0.5 ${msg.sender_id === user?.id ? "justify-end" : ""}`}>
                  {formatTime(msg.created_at)}
                  <MessageStatus isRead={msg.is_read} isMine={msg.sender_id === user?.id} />
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">{partnerId ? "No messages yet. Say hi! 👋" : "Link with your partner to start chatting"}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {showAttach && !isRecording && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="px-4 pb-2 flex gap-2">
            <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-2 bg-card rounded-xl border border-border px-4 py-2.5 text-sm active:scale-[0.97] transition-transform">
              <ImageIcon className="h-4 w-4 text-muted-foreground" /> Photo
            </button>
            <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-2 bg-card rounded-xl border border-border px-4 py-2.5 text-sm active:scale-[0.97] transition-transform">
              <Camera className="h-4 w-4 text-muted-foreground" /> Camera
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-card rounded-xl border border-border px-4 py-2.5 text-sm active:scale-[0.97] transition-transform">
              <FileText className="h-4 w-4 text-muted-foreground" /> File
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 pb-20 pt-2">
        {isRecording ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 bg-destructive/10 rounded-2xl border border-destructive/20 px-4 py-3"
          >
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="h-3 w-3 rounded-full bg-destructive shrink-0"
            />
            <span className="text-sm font-medium text-destructive flex-1">
              Recording {formatRecTime(recordingTime)}
            </span>
            <button onClick={cancelRecording} className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </button>
            <button onClick={stopRecording} className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center shrink-0">
              <Send className="h-4 w-4 text-background" />
            </button>
          </motion.div>
        ) : (
          <div className="flex items-center gap-2 bg-card rounded-2xl border border-border px-3 py-2 shadow-sm">
            <button onClick={() => setShowAttach(!showAttach)} className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground transition-colors">
              <Paperclip className="h-4 w-4" />
            </button>
            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Type a message..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            {message.trim() ? (
              <button onClick={handleSend} className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center shrink-0 transition-transform active:scale-95">
                <Send className="h-4 w-4 text-background" />
              </button>
            ) : (
              <button
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={() => { if (isRecording) cancelRecording(); }}
                className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center shrink-0 transition-transform active:scale-95"
              >
                <Mic className="h-4 w-4 text-background" />
              </button>
            )}
          </div>
        )}
      </div>

      <input ref={imageInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFileSelect(e, "image")} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e, "file")} />

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear chat?</AlertDialogTitle>
            <AlertDialogDescription>This will remove all messages. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearChat} className="rounded-xl bg-destructive text-destructive-foreground">Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default Chat;
