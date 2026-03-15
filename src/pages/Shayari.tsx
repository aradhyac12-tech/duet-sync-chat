import PageHeader from "@/components/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, BookOpen, Feather } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { hapticLight, hapticNotification } from "@/lib/haptics";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface ShayariItem {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  created_at: string;
}

const Shayari = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [shayaris, setShayaris] = useState<ShayariItem[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newShayari, setNewShayari] = useState({ title: "", content: "" });
  const [profiles, setProfiles] = useState<Record<string, { name: string; avatar: string | null }>>({});

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data } = await supabase
        .from("shayaris")
        .select("*")
        .order("created_at", { ascending: false }) as any;
      if (data) setShayaris(data);

      const { data: p } = await supabase.from("profiles").select("user_id, display_name, pet_name, avatar_url");
      if (p) {
        const map: Record<string, { name: string; avatar: string | null }> = {};
        (p as any[]).forEach((prof) => {
          map[prof.user_id] = {
            name: prof.pet_name || prof.display_name,
            avatar: prof.avatar_url,
          };
        });
        setProfiles(map);
      }
    };
    load();

    // Realtime listener for new shayaris from partner
    const channel = supabase
      .channel("shayaris-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shayaris" },
        (payload) => {
          const newItem = payload.new as ShayariItem;
          if (newItem.user_id !== user.id) {
            hapticNotification("success");
            toast({
              title: "✨ New Shayari!",
              description: `${profiles[newItem.user_id]?.name || "Your partner"} added a new shayari`,
            });
          }
          setShayaris((prev) => [newItem, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "shayaris" },
        (payload) => {
          setShayaris((prev) => prev.filter((s) => s.id !== (payload.old as any).id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const addShayari = async () => {
    if (!user || !newShayari.content.trim()) return;
    hapticLight();
    const { error } = await supabase.from("shayaris").insert({
      user_id: user.id,
      title: newShayari.title.trim() || null,
      content: newShayari.content.trim(),
    } as any);

    if (error) {
      toast({ title: "Couldn't add shayari", description: error.message, variant: "destructive" });
    } else {
      setShowAddDialog(false);
      setNewShayari({ title: "", content: "" });
      toast({ title: "Shayari added ✨" });
    }
  };

  const deleteShayari = async (id: string) => {
    hapticLight();
    await supabase.from("shayaris").delete().eq("id", id);
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-24">
      <PageHeader title="Shayari" subtitle="Words from the heart">
        <button
          onClick={() => { hapticLight(); setShowAddDialog(true); }}
          className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center"
        >
          <Plus className="h-5 w-5 text-foreground" />
        </button>
      </PageHeader>

      <div className="px-5 space-y-4">
        {shayaris.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center mx-auto">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No shayaris yet. Write your first!</p>
            <Button
              onClick={() => setShowAddDialog(true)}
              variant="outline"
              className="rounded-xl gap-2"
            >
              <Feather className="h-4 w-4" /> Write a Shayari
            </Button>
          </div>
        ) : (
          <AnimatePresence>
            {shayaris.map((shayari, i) => {
              const isOwn = shayari.user_id === user?.id;
              const author = profiles[shayari.user_id];
              return (
                <motion.div
                  key={shayari.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -80 }}
                  transition={{ delay: i * 0.03 }}
                  className="relative bg-card rounded-2xl border border-border p-5 shadow-sm"
                >
                  {/* Decorative quote */}
                  <div className="absolute top-3 left-4 text-4xl text-muted-foreground/10 font-serif leading-none select-none">"</div>

                  {shayari.title && (
                    <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wider">
                      {shayari.title}
                    </p>
                  )}

                  <p className="text-[15px] leading-relaxed whitespace-pre-line text-foreground/90 italic pl-3">
                    {shayari.content}
                  </p>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
                    <div className="flex items-center gap-2">
                      {author?.avatar ? (
                        <img src={author.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-[9px] font-semibold text-muted-foreground">
                            {(author?.name || "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {author?.name || "Unknown"} · {formatDate(shayari.created_at)}
                      </span>
                    </div>

                    {isOwn && (
                      <button
                        onClick={() => deleteShayari(shayari.id)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Add shayari dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Feather className="h-5 w-5" /> Write a Shayari
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Title (optional)
              </label>
              <Input
                value={newShayari.title}
                onChange={(e) => setNewShayari({ ...newShayari, title: e.target.value })}
                placeholder="e.g. Mohabbat"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Shayari *
              </label>
              <Textarea
                value={newShayari.content}
                onChange={(e) => setNewShayari({ ...newShayari, content: e.target.value })}
                placeholder="Write your shayari here..."
                className="rounded-xl min-h-[120px] resize-none"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={addShayari}
              disabled={!newShayari.content.trim()}
              className="rounded-xl bg-foreground text-background w-full"
            >
              Add Shayari
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Shayari;
