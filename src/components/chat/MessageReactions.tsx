import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SmilePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const EMOJI_OPTIONS = ["❤️", "😂", "👍", "😮", "😢", "🔥"];

interface Reaction {
  id: string;
  emoji: string;
  user_id: string;
  message_id: string;
}

interface MessageReactionsProps {
  messageId: string;
  userId: string;
  isMine: boolean;
}

const MessageReactions = ({ messageId, userId, isMine }: MessageReactionsProps) => {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const fetchReactions = useCallback(async () => {
    const { data } = await supabase
      .from("message_reactions")
      .select("*")
      .eq("message_id", messageId);
    if (data) setReactions(data);
  }, [messageId]);

  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  useEffect(() => {
    const channel = supabase
      .channel(`reactions-${messageId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions", filter: `message_id=eq.${messageId}` }, () => {
        fetchReactions();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [messageId, fetchReactions]);

  const toggleReaction = async (emoji: string) => {
    setShowPicker(false);
    const existing = reactions.find((r) => r.user_id === userId && r.emoji === emoji);
    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
    } else {
      const { data } = await supabase
        .from("message_reactions")
        .insert({ message_id: messageId, user_id: userId, emoji })
        .select()
        .single();
      if (data) setReactions((prev) => [...prev, data]);
    }
  };

  // Group reactions by emoji
  const grouped = reactions.reduce<Record<string, { count: number; byMe: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, byMe: false };
    acc[r.emoji].count++;
    if (r.user_id === userId) acc[r.emoji].byMe = true;
    return acc;
  }, {});

  return (
    <div className={`flex flex-wrap items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
      {Object.entries(grouped).map(([emoji, { count, byMe }]) => (
        <button
          key={emoji}
          onClick={() => toggleReaction(emoji)}
          className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
            byMe ? "bg-primary/20 border-primary/30" : "bg-muted/50 border-border"
          }`}
        >
          {emoji} {count > 1 && <span className="text-[10px] text-muted-foreground">{count}</span>}
        </button>
      ))}

      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <SmilePlus className="h-3 w-3" />
        </button>
        <AnimatePresence>
          {showPicker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`absolute ${isMine ? "right-0" : "left-0"} bottom-7 z-50 flex gap-1 bg-card border border-border rounded-xl px-2 py-1.5 shadow-lg`}
            >
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  className="text-base hover:scale-125 transition-transform px-0.5"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MessageReactions;
