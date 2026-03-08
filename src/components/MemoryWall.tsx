import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, ImageIcon, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface Memory {
  id: string;
  creator_id: string;
  caption: string | null;
  image_url: string | null;
  created_at: string;
}

const MemoryWall = () => {
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [viewMemory, setViewMemory] = useState<Memory | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("memories")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setMemories(data);
    };
    load();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addMemory = async () => {
    if (!user || (!selectedImage && !caption.trim())) return;
    setUploading(true);

    let imageUrl: string | null = null;
    if (selectedImage) {
      const path = `${user.id}/${Date.now()}_${selectedImage.name}`;
      const { data } = await supabase.storage.from("memories").upload(path, selectedImage);
      if (data) {
        const { data: urlData } = supabase.storage.from("memories").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
    }

    const { data } = await supabase
      .from("memories")
      .insert({ creator_id: user.id, caption: caption || null, image_url: imageUrl })
      .select()
      .single();

    if (data) setMemories((prev) => [data, ...prev]);
    setShowAdd(false);
    setCaption("");
    setSelectedImage(null);
    setPreview(null);
    setUploading(false);
  };

  const deleteMemory = async (id: string) => {
    await supabase.from("memories").delete().eq("id", id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    setViewMemory(null);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Memory Wall</h2>
        <button onClick={() => setShowAdd(true)} className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {memories.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-6 text-center shadow-sm">
          <ImageIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Pin your favorite moments here</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <AnimatePresence>
            {memories.map((m, i) => (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setViewMemory(m)}
                className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border group"
              >
                {m.image_url ? (
                  <img src={m.image_url} alt={m.caption || "Memory"} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-accent/30">
                    <p className="text-sm text-foreground px-3 text-center font-serif">{m.caption}</p>
                  </div>
                )}
                {m.image_url && m.caption && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-[11px] text-white truncate">{m.caption}</p>
                  </div>
                )}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add memory dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Pin a Memory</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {preview ? (
              <div className="relative aspect-video rounded-xl overflow-hidden">
                <img src={preview} alt="preview" className="w-full h-full object-cover" />
                <button onClick={() => { setSelectedImage(null); setPreview(null); }}
                  className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 flex items-center justify-center">
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full aspect-video rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-foreground/30 transition-colors">
                <ImageIcon className="h-8 w-8" />
                <span className="text-xs">Choose a photo</span>
              </button>
            )}
            <Input value={caption} onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption..." className="rounded-xl" />
          </div>
          <DialogFooter>
            <Button onClick={addMemory} disabled={uploading || (!selectedImage && !caption.trim())}
              className="rounded-xl bg-foreground text-background w-full">
              {uploading ? "Pinning..." : "Pin Memory"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View memory dialog */}
      <Dialog open={!!viewMemory} onOpenChange={() => setViewMemory(null)}>
        <DialogContent className="rounded-2xl max-w-sm p-0 overflow-hidden">
          {viewMemory?.image_url && (
            <img src={viewMemory.image_url} alt={viewMemory.caption || ""} className="w-full max-h-80 object-cover" />
          )}
          <div className="p-4 space-y-2">
            {viewMemory?.caption && <p className="text-sm">{viewMemory.caption}</p>}
            <p className="text-[11px] text-muted-foreground">
              {viewMemory && new Date(viewMemory.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
            </p>
            {viewMemory && user?.id === viewMemory.creator_id && (
              <button onClick={() => deleteMemory(viewMemory.id)}
                className="flex items-center gap-1.5 text-xs text-destructive mt-2">
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
    </section>
  );
};

export default MemoryWall;
