import { motion } from "framer-motion";
import { X, Download } from "lucide-react";

interface PhotoViewerProps {
  src: string;
  onClose: () => void;
}

const PhotoViewer = ({ src, onClose }: PhotoViewerProps) => {
  const handleSave = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `photo_${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2 safe-top">
        <button
          onClick={onClose}
          className="h-9 w-9 rounded-full bg-muted/50 flex items-center justify-center"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleSave(); }}
          className="h-9 w-9 rounded-full bg-muted/50 flex items-center justify-center"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <motion.img
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          src={src}
          alt=""
          className="max-w-full max-h-full object-contain rounded-2xl"
        />
      </div>
    </motion.div>
  );
};

export default PhotoViewer;
