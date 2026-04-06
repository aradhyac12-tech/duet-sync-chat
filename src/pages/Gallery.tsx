import PageHeader from "@/components/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ImageIcon, Lock, Unlock, Eye, EyeOff, Trash2, Camera } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import CameraWithFilters from "@/components/CameraWithFilters";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GalleryItem {
  id: string;
  file_url: string;
  file_type: string;
  owner_id: string;
  is_shared: boolean;
  created_at: string;
}

const Gallery = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [myItems, setMyItems] = useState<GalleryItem[]>([]);
  const [sharedItems, setSharedItems] = useState<GalleryItem[]>([]);
  const [partnerItems, setPartnerItems] = useState<GalleryItem[]>([]);
  const [myGalleryShared, setMyGalleryShared] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: profile } = await supabase.from("profiles").select("partner_id, gallery_shared").eq("user_id", user.id).single();
      if (profile) {
        setPartnerId(profile.partner_id);
        setMyGalleryShared(profile.gallery_shared);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchItems = async () => {
      const { data: mine } = await supabase.from("gallery_items").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
      if (mine) setMyItems(mine);

      if (partnerId) {
        const { data: partner } = await supabase.from("gallery_items").select("*").eq("owner_id", partnerId).order("created_at", { ascending: false });
        if (partner) setPartnerItems(partner);

        const allShared = [
          ...(mine?.filter((i) => i.is_shared) || []),
          ...(partner?.filter((i) => i.is_shared) || []),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setSharedItems(allShared);
      }
    };
    fetchItems();
  }, [user, partnerId]);

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    await saveToGallery(file);
    setUploading(false);
    e.target.value = "";
  };

  const saveToGallery = async (file: File | Blob, fileName?: string) => {
    if (!user) return;
    const ext = file instanceof File ? (file.name.split(".").pop() || "jpg") : "jpg";
    const name = fileName || `${Date.now()}.${ext}`;
    const path = `${user.id}/${Date.now()}_${name}`;
    const { data: uploadData, error: uploadErr } = await supabase.storage.from("gallery").upload(path, file, { contentType: file.type || "image/jpeg" });
    if (uploadErr || !uploadData) {
      console.error("Gallery upload error:", uploadErr);
      toast({ title: "Upload failed", description: uploadErr?.message, variant: "destructive" });
      return;
    }
    const { data: urlData } = supabase.storage.from("gallery").getPublicUrl(path);
    const { data: item } = await supabase.from("gallery_items").insert({
      owner_id: user.id,
      file_url: urlData.publicUrl,
      file_type: file.type?.startsWith("video") ? "video" : "image",
      is_shared: false,
    }).select().single();
    if (item) {
      setMyItems((prev) => [item, ...prev]);
      toast({ title: "Photo added! 📸" });
    }
  };

  const handleCameraCapture = async (blob: Blob, filterName: string) => {
    setShowCamera(false);
    setUploading(true);
    await saveToGallery(blob, `camera_${filterName}_${Date.now()}.jpg`);
    setUploading(false);
  };

  const toggleShare = async (itemId: string, currentlyShared: boolean) => {
    await supabase.from("gallery_items").update({ is_shared: !currentlyShared }).eq("id", itemId);
    setMyItems((prev) => prev.map((i) => i.id === itemId ? { ...i, is_shared: !currentlyShared } : i));
    toast({ title: currentlyShared ? "Unshared" : "Shared with partner 💕" });
  };

  const deleteItem = async (id: string) => {
    await supabase.from("gallery_items").delete().eq("id", id);
    setMyItems((prev) => prev.filter((i) => i.id !== id));
    setSharedItems((prev) => prev.filter((i) => i.id !== id));
    setShowDeleteDialog(null);
    toast({ title: "Deleted" });
  };

  const toggleGallerySharing = async () => {
    if (!user) return;
    const newVal = !myGalleryShared;
    await supabase.from("profiles").update({ gallery_shared: newVal }).eq("user_id", user.id);
    setMyGalleryShared(newVal);
    setShowShareDialog(false);
    toast({ title: newVal ? "Gallery shared with partner" : "Gallery is now private" });
  };

  const GalleryGrid = ({ items, showActions = false }: { items: GalleryItem[]; showActions?: boolean }) => (
    <div className="grid grid-cols-3 gap-1 px-1">
      {items.length === 0 ? (
        <div className="col-span-3 py-12 text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No photos yet</p>
        </div>
      ) : (
        items.map((item, i) => (
          <motion.div key={item.id}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className="aspect-square rounded-xl overflow-hidden relative group">
            <img src={item.file_url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => setViewImage(item.file_url)} />
            {showActions && (
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => toggleShare(item.id, item.is_shared)}
                  className="h-7 w-7 rounded-full bg-black/50 flex items-center justify-center">
                  {item.is_shared ? <Eye className="h-3.5 w-3.5 text-white" /> : <EyeOff className="h-3.5 w-3.5 text-white" />}
                </button>
                <button onClick={() => setShowDeleteDialog(item.id)}
                  className="h-7 w-7 rounded-full bg-black/50 flex items-center justify-center">
                  <Trash2 className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            )}
            {item.is_shared && (
              <div className="absolute bottom-1 left-1">
                <div className="h-5 w-5 rounded-full bg-primary/80 flex items-center justify-center">
                  <Eye className="h-3 w-3 text-primary-foreground" />
                </div>
              </div>
            )}
          </motion.div>
        ))
      )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-24">
      <PageHeader title="Gallery" subtitle="Our moments">
        <div className="flex gap-2">
          <button onClick={() => setShowShareDialog(true)}
            className="h-9 px-3 rounded-xl bg-accent flex items-center gap-1.5 text-xs font-medium">
            {myGalleryShared ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {myGalleryShared ? "Shared" : "Private"}
          </button>
          <button onClick={() => setShowCamera(true)}
            className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center">
            <Camera className="h-4 w-4 text-background" />
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center">
            <Plus className="h-5 w-5 text-foreground" />
          </button>
        </div>
      </PageHeader>

      <Tabs defaultValue="shared" className="px-4">
        <TabsList className="w-full bg-muted/50 rounded-xl">
          <TabsTrigger value="shared" className="flex-1 rounded-lg text-xs">Shared</TabsTrigger>
          <TabsTrigger value="mine" className="flex-1 rounded-lg text-xs">Mine</TabsTrigger>
          <TabsTrigger value="theirs" className="flex-1 rounded-lg text-xs">Theirs</TabsTrigger>
        </TabsList>

        <TabsContent value="shared" className="mt-4"><GalleryGrid items={sharedItems} /></TabsContent>
        <TabsContent value="mine" className="mt-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-xs text-muted-foreground">
              {myGalleryShared ? "Your partner can see these photos" : "Only you can see these photos"}
            </p>
            <button onClick={() => setShowShareDialog(true)}>
              {myGalleryShared ? <Unlock className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>
          <GalleryGrid items={myItems} showActions />
        </TabsContent>
        <TabsContent value="theirs" className="mt-4">
          {!partnerId ? (
            <div className="py-12 text-center">
              <Lock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Link with a partner first</p>
            </div>
          ) : <GalleryGrid items={partnerItems} />}
        </TabsContent>
      </Tabs>

      {viewImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setViewImage(null)}>
          <img src={viewImage} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {showCamera && <CameraWithFilters onClose={() => setShowCamera(false)} onCapture={handleCameraCapture} />}

      <AlertDialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{myGalleryShared ? "Make gallery private?" : "Share your gallery?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {myGalleryShared ? "Your partner will no longer be able to view your photos." : "Your partner will be able to see all photos in your gallery. You can revoke access anytime."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={toggleGallerySharing} className="rounded-xl">
              {myGalleryShared ? "Make Private" : "Share Gallery"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete photo?</AlertDialogTitle>
            <AlertDialogDescription>This photo will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => showDeleteDialog && deleteItem(showDeleteDialog)} className="rounded-xl bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={uploadPhoto} />
    </motion.div>
  );
};

export default Gallery;
