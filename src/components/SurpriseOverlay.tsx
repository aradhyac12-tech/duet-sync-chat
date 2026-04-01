import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Surprise {
  id: string;
  title: string;
  html_content: string;
  css_content: string;
  js_content: string;
  max_views: number;
  views_used: number;
  creator_id: string;
}

const SurpriseOverlay = () => {
  const { user } = useAuth();
  const [surprise, setSurprise] = useState<Surprise | null>(null);
  const [show, setShow] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!user) return;
    const checkSurprises = async () => {
      // Get partner's active surprises that haven't exceeded max views
      const { data } = await supabase
        .from("code_surprises")
        .select("*")
        .neq("creator_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1) as any;

      if (data && data.length > 0) {
        const s = data[0] as Surprise;
        if (s.views_used < s.max_views) {
          const seen = JSON.parse(sessionStorage.getItem("seen-surprises") || "[]");
          if (!seen.includes(s.id)) {
            setSurprise(s);
            setShow(true);
            seen.push(s.id);
            sessionStorage.setItem("seen-surprises", JSON.stringify(seen));
            // Increment views
            await supabase.from("code_surprises").update({ views_used: s.views_used + 1 } as any).eq("id", s.id);
          }
        }
      }
    };
    const timeout = setTimeout(checkSurprises, 2000);
    return () => clearTimeout(timeout);
  }, [user]);

  const handleClose = () => {
    setShow(false);
    setTimeout(() => setSurprise(null), 300);
  };

  useEffect(() => {
    if (show && surprise && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><style>${surprise.css_content}</style></head><body>${surprise.html_content}<script>${surprise.js_content}<\/script></body></html>`);
        doc.close();
      }
    }
  }, [show, surprise]);

  return (
    <AnimatePresence>
      {show && surprise && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="fixed inset-0 z-[100] bg-background flex flex-col"
        >
          <div className="safe-top px-4 pt-3 flex items-center justify-between">
            <p className="text-sm font-semibold">{surprise.title}</p>
            <button onClick={handleClose} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 p-4">
            <iframe
              ref={iframeRef}
              title="surprise"
              sandbox="allow-scripts"
              className="w-full h-full rounded-2xl border border-border/30 bg-white"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SurpriseOverlay;
