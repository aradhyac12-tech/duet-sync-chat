import PageHeader from "@/components/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, ImageIcon, FileText, Trash2, MoreVertical, Camera } from "lucide-react";
import { useState, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Message {
  id: string;
  text: string;
  sender: "me" | "them";
  time: string;
  type: "text" | "image" | "file";
  fileName?: string;
  fileUrl?: string;
}

const initialMessages: Message[] = [
  { id: "1", text: "Hey, how's your day going? 💫", sender: "them", time: "2:34 PM", type: "text" },
  { id: "2", text: "Amazing now that you texted ✨", sender: "me", time: "2:35 PM", type: "text" },
  { id: "3", text: "Miss you! When are we meeting? 🤍", sender: "them", time: "2:36 PM", type: "text" },
];

const Chat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { chatWallpaper } = useTheme();

  const handleSend = () => {
    if (!message.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      text: message,
      sender: "me",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      type: "text",
    };
    setMessages((prev) => [...prev, newMsg]);
    setMessage("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      text: type === "image" ? "📷 Photo" : `📎 ${file.name}`,
      sender: "me",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      type,
      fileName: file.name,
      fileUrl: URL.createObjectURL(file),
    };
    setMessages((prev) => [...prev, newMsg]);
    setShowAttach(false);
  };

  const clearChat = () => {
    setMessages([]);
    setShowClearDialog(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-screen"
    >
      <PageHeader title="Chat" subtitle="Just the two of us">
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

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
        style={chatWallpaper ? {
          backgroundImage: chatWallpaper.startsWith("url(") ? chatWallpaper : undefined,
          background: chatWallpaper.startsWith("linear") ? chatWallpaper : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        } : undefined}
      >
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-2xl px-4 py-2.5 max-w-[75%] ${
                  msg.sender === "me"
                    ? "bg-primary/20 rounded-br-md"
                    : "bg-card rounded-bl-md shadow-sm border border-border"
                }`}
              >
                {msg.type === "image" && msg.fileUrl && (
                  <img src={msg.fileUrl} alt="shared" className="rounded-lg mb-2 max-h-48 object-cover w-full" />
                )}
                {msg.type === "file" && (
                  <div className="flex items-center gap-2 mb-1 bg-muted/50 rounded-lg px-3 py-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate">{msg.fileName}</span>
                  </div>
                )}
                <p className="text-sm">{msg.text}</p>
                <span className={`text-[10px] text-muted-foreground mt-1 block ${msg.sender === "me" ? "text-right" : ""}`}>
                  {msg.time}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">No messages yet. Say hi! 👋</p>
          </div>
        )}
      </div>

      {/* Attachment options */}
      <AnimatePresence>
        {showAttach && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="px-4 pb-2 flex gap-2"
          >
            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-2 bg-card rounded-xl border border-border px-4 py-2.5 text-sm active:scale-[0.97] transition-transform"
            >
              <ImageIcon className="h-4 w-4 text-muted-foreground" /> Photo
            </button>
            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-2 bg-card rounded-xl border border-border px-4 py-2.5 text-sm active:scale-[0.97] transition-transform"
            >
              <Camera className="h-4 w-4 text-muted-foreground" /> Camera
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-card rounded-xl border border-border px-4 py-2.5 text-sm active:scale-[0.97] transition-transform"
            >
              <FileText className="h-4 w-4 text-muted-foreground" /> File
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="px-4 pb-20 pt-2">
        <div className="flex items-center gap-2 bg-card rounded-2xl border border-border px-3 py-2 shadow-sm">
          <button
            onClick={() => setShowAttach(!showAttach)}
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center shrink-0 transition-transform active:scale-95"
          >
            <Send className="h-4 w-4 text-background" />
          </button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFileSelect(e, "image")} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e, "file")} />

      {/* Clear chat dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearChat} className="rounded-xl bg-destructive text-destructive-foreground">
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default Chat;
