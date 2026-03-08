import PageHeader from "@/components/PageHeader";
import { motion } from "framer-motion";
import { Plus, ImageIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const placeholders = Array.from({ length: 9 }, (_, i) => i);

const GalleryGrid = () => (
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
);

const Gallery = () => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <PageHeader title="Gallery" subtitle="Our moments">
        <button className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center">
          <Plus className="h-5 w-5 text-foreground" />
        </button>
      </PageHeader>

      <Tabs defaultValue="shared" className="px-4">
        <TabsList className="w-full bg-muted/50 rounded-xl">
          <TabsTrigger value="shared" className="flex-1 rounded-lg text-xs">Shared</TabsTrigger>
          <TabsTrigger value="mine" className="flex-1 rounded-lg text-xs">Mine</TabsTrigger>
          <TabsTrigger value="theirs" className="flex-1 rounded-lg text-xs">Theirs</TabsTrigger>
        </TabsList>
        <TabsContent value="shared" className="mt-4">
          <GalleryGrid />
        </TabsContent>
        <TabsContent value="mine" className="mt-4">
          <GalleryGrid />
        </TabsContent>
        <TabsContent value="theirs" className="mt-4">
          <GalleryGrid />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default Gallery;
