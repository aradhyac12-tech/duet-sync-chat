/**
 * BackupManager — WhatsApp-style Google Drive backup UI
 * Shown in Settings under "Backup & Restore"
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudUpload, RotateCcw, Check, AlertCircle, ChevronRight, Loader2, LogIn, LogOut, HardDrive, KeyRound, Copy } from "lucide-react";
import { useGoogleBackup, BackupInfo } from "@/hooks/useGoogleBackup";
import { useToast } from "@/hooks/use-toast";

const formatBytes = (bytes: string | number) => {
  const b = typeof bytes === "string" ? parseInt(bytes) : bytes;
  if (!b || b === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day:"numeric", month:"short", year:"numeric" }) +
    " at " + d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
};

const BackupManager = () => {
  const { toast } = useToast();
  const {
    status, error, progress, backups, lastBackup,
    isSignedIn, signInWithGoogle, signOut,
    backup, restore, listBackups, exportDeviceSecret,
  } = useGoogleBackup();

  const [showRestoreList, setShowRestoreList] = useState(false);
  // FIX #10: Track the secret modal — user must explicitly export this key
  // or they lose access to backups if they switch devices/browsers.
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [deviceSecret, setDeviceSecret] = useState("");
  const [confirmRestore,  setConfirmRestore]  = useState<BackupInfo | null>(null);
  const [loadingList,     setLoadingList]     = useState(false);

  const handleBackup = async () => {
    if (!isSignedIn) { signInWithGoogle(); return; }
    await backup();
    toast({ title: status === "done" ? "Backup complete ✓" : "Backup failed", variant: status === "error" ? "destructive" : "default" });
  };

  const handleShowRestoreList = async () => {
    setLoadingList(true);
    await listBackups();
    setLoadingList(false);
    setShowRestoreList(true);
  };

  const handleRestore = async (b: BackupInfo) => {
    setConfirmRestore(null);
    await restore(b.id);
    toast({ title: "Restore complete ✓ — refresh the app" });
  };

  const handleShowSecret = async () => {
    const secret = await exportDeviceSecret();
    setDeviceSecret(secret);
    setShowSecretModal(true);
  };

  const copySecret = () => {
    navigator.clipboard.writeText(deviceSecret);
    toast({ title: "Encryption key copied", description: "Save it somewhere safe — you need it to restore on a new device." });
  };

  const isRunning = status === "backing_up" || status === "restoring";

  return (
    <section>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2.5">
        Backup &amp; Restore
      </p>

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
        {/* Google account status */}
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
            <HardDrive className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Google Drive</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {isSignedIn ? "Connected — backups saved to your Drive" : "Sign in to enable backups"}
            </p>
          </div>
          {isSignedIn ? (
            <button onClick={signOut} className="h-7 px-3 rounded-full bg-muted text-[11px] text-muted-foreground flex items-center gap-1">
              <LogOut className="h-3 w-3" /> Sign out
            </button>
          ) : (
            <button onClick={signInWithGoogle} className="h-7 px-3 rounded-full bg-blue-500 text-[11px] text-white flex items-center gap-1">
              <LogIn className="h-3 w-3" /> Sign in
            </button>
          )}
        </div>

        {/* Last backup info */}
        {lastBackup && (
          <div className="px-4 py-2">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Check className="h-3 w-3 text-green-500 shrink-0" />
              Last backup: {formatDate(lastBackup)}
            </p>
          </div>
        )}

        {/* Progress bar */}
        <AnimatePresence>
          {isRunning && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-4 py-3 space-y-1.5">
                <div className="flex justify-between items-center">
                  <p className="text-[11px] text-muted-foreground">
                    {status === "backing_up" ? "Backing up…" : "Restoring…"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{progress}%</p>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
            <p className="text-[11px] text-destructive leading-relaxed">{error}</p>
          </div>
        )}

        {/* Backup button */}
        <button
          onClick={handleBackup}
          disabled={isRunning}
          className="w-full flex items-center gap-3 px-4 py-3 active:bg-muted/40 disabled:opacity-40"
        >
          {isRunning && status === "backing_up"
            ? <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
            : <CloudUpload className="h-4 w-4 text-primary shrink-0" />}
          <div className="flex-1 text-left">
            <p className="text-sm font-medium">Backup Now</p>
            <p className="text-[11px] text-muted-foreground">All messages &amp; gallery metadata</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Restore button */}
        <button
          onClick={handleShowRestoreList}
          disabled={isRunning || !isSignedIn}
          className="w-full flex items-center gap-3 px-4 py-3 active:bg-muted/40 disabled:opacity-40"
        >
          {loadingList
            ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
            : <RotateCcw className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div className="flex-1 text-left">
            <p className="text-sm font-medium">Restore from Backup</p>
            <p className="text-[11px] text-muted-foreground">Choose a previous backup to restore</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Restore list sheet */}
      <AnimatePresence>
        {showRestoreList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setShowRestoreList(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl pb-safe"
              onClick={e => e.stopPropagation()}
            >
              <div className="pt-3 pb-2 px-4 flex items-center justify-between border-b border-border/40">
                <p className="text-sm font-semibold">Your Backups</p>
                <button onClick={() => setShowRestoreList(false)} className="text-[11px] text-muted-foreground">Done</button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {backups.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm text-muted-foreground">No backups found</p>
                  </div>
                ) : (
                  backups.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setConfirmRestore(b)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-border/30 active:bg-muted/40 text-left"
                    >
                      <CloudUpload className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{formatDate(b.createdTime)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {b.messageCount} messages · {b.galleryCount} photos · {formatBytes(b.size)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm restore dialog */}
      <AnimatePresence>
        {confirmRestore && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center px-6"
          >
            <motion.div
              initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
              className="bg-card rounded-2xl p-5 w-full max-w-sm"
            >
              <p className="text-base font-semibold mb-1">Restore this backup?</p>
              <p className="text-sm text-muted-foreground mb-4">
                From {formatDate(confirmRestore.createdTime)}.
                This will merge {confirmRestore.messageCount} messages into your current history.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmRestore(null)}
                  className="flex-1 h-10 rounded-xl border border-border text-sm">Cancel</button>
                <button onClick={() => handleRestore(confirmRestore)}
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium">Restore</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Device secret export modal — FIX #10 */}
      <AnimatePresence>
        {showSecretModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center px-6"
          >
            <motion.div
              initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
              className="bg-card rounded-2xl p-5 w-full max-w-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="h-5 w-5 text-amber-500" />
                <p className="text-base font-semibold">Your encryption key</p>
              </div>
              <p className="text-[12px] text-muted-foreground mb-3">
                This key encrypts your backups. If you restore on a new device or browser,
                you will be asked for this key. Save it in a password manager.
              </p>
              <div className="bg-muted rounded-xl px-3 py-2 mb-3 break-all font-mono text-[11px] select-all">
                {deviceSecret}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSecretModal(false)}
                  className="flex-1 h-10 rounded-xl border border-border text-sm"
                >Close</button>
                <button
                  onClick={copySecret}
                  className="flex-1 h-10 rounded-xl bg-amber-500 text-white text-sm font-medium flex items-center justify-center gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy key
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default BackupManager;
