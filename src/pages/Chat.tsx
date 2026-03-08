import PageHeader from "@/components/PageHeader";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { useState } from "react";

const Chat = () => {
  const [message, setMessage] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-screen"
    >
      <PageHeader title="Chat" subtitle="Just the two of us" />

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {/* Sample messages */}
        <div className="flex justify-start">
          <div className="bg-card rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[75%] shadow-sm border border-border">
            <p className="text-sm">Hey, how's your day going? 💫</p>
            <span className="text-[10px] text-muted-foreground mt-1 block">2:34 PM</span>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="bg-primary/20 rounded-2xl rounded-br-md px-4 py-2.5 max-w-[75%]">
            <p className="text-sm">Amazing now that you texted ✨</p>
            <span className="text-[10px] text-muted-foreground mt-1 block text-right">2:35 PM</span>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-card rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[75%] shadow-sm border border-border">
            <p className="text-sm">Miss you! When are we meeting? 🤍</p>
            <span className="text-[10px] text-muted-foreground mt-1 block">2:36 PM</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-20 pt-2">
        <div className="flex items-center gap-2 bg-card rounded-2xl border border-border px-4 py-2 shadow-sm">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center shrink-0 transition-transform active:scale-95">
            <Send className="h-4 w-4 text-background" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default Chat;
