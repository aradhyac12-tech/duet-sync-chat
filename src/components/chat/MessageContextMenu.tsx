import { motion, AnimatePresence } from "framer-motion";
import { Copy, Trash2, Forward, Reply, X } from "lucide-react";
import { useCallback } from "react";

interface MessageContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onForward: () => void;
  onReply: () => void;
  isMine: boolean;
  messageContent: string | null;
}

const MessageContextMenu = ({
  isOpen,
  onClose,
  onCopy,
  onDelete,
  onForward,
  onReply,
  isMine,
  messageContent,
}: MessageContextMenuProps) => {
  const handleAction = useCallback(
    (action: () => void) => {
      action();
      onClose();
    },
    [onClose]
  );

  const actions = [
    { icon: Reply, label: "Reply", action: onReply, show: true },
    { icon: Copy, label: "Copy", action: onCopy, show: !!messageContent },
    { icon: Forward, label: "Forward", action: onForward, show: true },
    { icon: Trash2, label: "Delete", action: onDelete, show: isMine, destructive: true },
  ].filter((a) => a.show);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-foreground/20"
            style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
            onClick={onClose}
          />

          {/* Menu */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-card border border-border/60 rounded-2xl shadow-xl overflow-hidden min-w-[200px]"
          >
            {actions.map((item, i) => (
              <button
                key={item.label}
                onClick={() => handleAction(item.action)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors active:bg-muted/60
                  ${i < actions.length - 1 ? "border-b border-border/30" : ""}
                  ${item.destructive ? "text-destructive" : "text-foreground"}
                `}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MessageContextMenu;
