import PageHeader from "@/components/PageHeader";
import { motion } from "framer-motion";
import { Plus, ImageIcon, Lock, Unlock, Eye, EyeOff, Settings } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState } from "react";
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

const placeholders = Array.from({ length: 9 }, (_, i) => i);

const GalleryGrid = ({ locked, onToggle }: { locked: boolean; onToggle: () => void }) => (
  <div>
    {locked && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-12 space-y-3"
      >
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Gallery is private</p>
        <button
          onClick={onToggle}
          className="text-xs bg-accent text-accent-foreground rounded-lg px-4 py-2"
        >
          Request Access
        </button>
      </motion.div>
    )}
    {!locked && (
      <div className="grid grid-cols-3 gap-1 px-1">
        {placeholders.map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="aspect-square rounded-xl bg-sand/50 flex items-center justify-center"
          >
            <ImageIcon className="h-6 w-6 text-taupe/40" />
          </motion.div>
        ))}
      </div>
    )}
  </div>
);

const Gallery = () => {
  const [myGalleryShared, setMyGalleryShared] = useState(false);
  const [theirGalleryAccess, setTheirGalleryAccess] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showAccessDialog, setShowAccessDialog] = useState(false);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <PageHeader title="Gallery" subtitle="Our moments">
        <div className="flex gap-2">
          <button
            onClick={() => setShowShareDialog(true)}
            className="h-9 px-3 rounded-xl bg-accent flex items-center gap-1.5 text-xs font-medium"
          >
            {myGalleryShared ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {myGalleryShared ? "Shared" : "Private"}
          </button>
          <button className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center">
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

        <TabsContent value="shared" className="mt-4">
          <GalleryGrid locked={false} onToggle={() => {}} />
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-xs text-muted-foreground">
              {myGalleryShared ? "Your partner can see these photos" : "Only you can see these photos"}
            </p>
            <button onClick={() => setShowShareDialog(true)}>
              {myGalleryShared ? (
                <Unlock className="h-4 w-4 text-primary" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
          <GalleryGrid locked={false} onToggle={() => {}} />
        </TabsContent>

        <TabsContent value="theirs" className="mt-4">
          <GalleryGrid
            locked={!theirGalleryAccess}
            onToggle={() => setShowAccessDialog(true)}
          />
        </TabsContent>
      </Tabs>

      {/* Share consent dialog */}
      <AlertDialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {myGalleryShared ? "Make gallery private?" : "Share your gallery?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {myGalleryShared
                ? "Your partner will no longer be able to view your photos."
                : "Your partner will be able to see all photos in your gallery. You can revoke access anytime."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setMyGalleryShared(!myGalleryShared);
                setShowShareDialog(false);
              }}
              className="rounded-xl"
            >
              {myGalleryShared ? "Make Private" : "Share Gallery"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Request access dialog */}
      <AlertDialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Request gallery access</AlertDialogTitle>
            <AlertDialogDescription>
              A request will be sent to your partner. They'll need to approve before you can view their photos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setTheirGalleryAccess(true);
                setShowAccessDialog(false);
              }}
              className="rounded-xl"
            >
              Send Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default Gallery;
