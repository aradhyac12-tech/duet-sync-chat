import PageHeader from "@/components/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, ImageIcon, FileText, Trash2, MoreVertical, Camera, Shield, ShieldOff } from "lucide-react";
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

const Chat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { chatWallpaper } = useTheme();
  const { user } = useAuth();
  const { ready: e2eReady, encrypt, decrypt } = useE2E(user?.id, partnerId);

  // Decrypt a batch of messages
  const decryptMessages = useCallback(async (msgs: Message[]): Promise<DecryptedMessage[]> => {
    return Promise.all(
      msgs.map(async (msg) => ({
        ...msg,
        decryptedContent: msg.message_type === "text" ? await decrypt(msg.content) : msg.content,
      }))
    );
  }, [decrypt]);

  // Fetch partner
  useEffect(() => {
    if (!user) return;
    const fetchPartner = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("partner_id")
        .eq("user_id", user.id)
        .single();
      if (data?.partner_id) setPartnerId(data.partner_id);
    };
    fetchPartner();
  }, [user]);

  // Fetch messages
  useEffect(() => {
    if (!user || !partnerId) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) {
        const decrypted = await decryptMessages(data);
        setMessages(decrypted);
      }
    };
    fetchMessages();
  }, [user, partnerId, decryptMessages]);

  // Realtime subscription
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
          supabase
            .from("messages")
            .select("*")
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
            .order("created_at", { ascending: true })
            .limit(200)
            .then(async ({ data }) => {
              if (data) {
                const decrypted = await decryptMessages(data);
                setMessages(decrypted);
              }
            });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, partnerId, decrypt, decryptMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || !user || !partnerId) return;
    const text = message;
    setMessage("");
    const encryptedText = e2eReady ? await encrypt(text) : text;
    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: partnerId,
      content: encryptedText,
      message_type: "text",
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
      sender_id: user.id,
      receiver_id: partnerId,
      content: type === "image" ? "📷 Photo" : `📎 ${file.name}`,
      message_type: type,
      file_url: urlData.publicUrl,
      file_name: file.name,
    });
    e.target.value = "";
  };

  const clearChat = async () => {
    if (!user || !partnerId) return;
    await supabase
      .from("messages")
      .delete()
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`);
    setMessages([]);
    setShowClearDialog(false);
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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

      {/* E2E indicator */}
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
                {msg.decryptedContent && <p className="text-sm">{msg.decryptedContent}</p>}
                <span className={`text-[10px] text-muted-foreground mt-1 block ${msg.sender_id === user?.id ? "text-right" : ""}`}>
                  {formatTime(msg.created_at)}
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
        {showAttach && (
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
        <div className="flex items-center gap-2 bg-card rounded-2xl border border-border px-3 py-2 shadow-sm">
          <button onClick={() => setShowAttach(!showAttach)} className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <Paperclip className="h-4 w-4" />
          </button>
          <input type="text" value={message} onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Type a message..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <button onClick={handleSend} className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center shrink-0 transition-transform active:scale-95">
            <Send className="h-4 w-4 text-background" />
          </button>
        </div>
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
