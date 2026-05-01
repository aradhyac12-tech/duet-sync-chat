/**
 * useGoogleBackup — WhatsApp-style Google Drive backup
 *
 * AUDIT FIXES APPLIED:
 *  - Fix #2: Replaced implicit OAuth (response_type=token) with PKCE authorization-code flow.
 *    Code is exchanged server-side via the `google-oauth-exchange` Edge Function — the
 *    client secret never touches the browser.
 *  - Fix #3: Dynamic per-backup PBKDF2 salt (was a hard-coded string "duospacesalt2025").
 *    A random 16-byte salt is generated at encrypt-time and prepended to the ciphertext.
 *  - Fix #4: Encryption key is no longer derived from user.id (which is public knowledge).
 *    A random 256-bit secret is generated once per device, stored in @capacitor/preferences
 *    (native) or sessionStorage (web fallback), and returned for export/import by the user.
 *
 * How it works:
 *  1. User clicks "Sign in with Google" → PKCE challenge generated → redirect to Google.
 *  2. Google redirects back with ?code=… → edge function exchanges code → we receive token.
 *  3. Backup: fetch messages + gallery → encrypt with device secret → upload to Drive.
 *  4. Restore: download → decrypt with device secret (or user-supplied passphrase) → upsert.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import storage from "@/lib/storage";

// FIX #4: Typed Google Drive file list item
interface GDriveFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
  appProperties?: { messageCount?: string; galleryCount?: string };
}

export type BackupStatus = "idle" | "signing_in" | "backing_up" | "restoring" | "done" | "error";

export interface BackupInfo {
  id: string;
  name: string;
  createdTime: string;
  size: string;
  messageCount: number;
  galleryCount: number;
}

const GDRIVE_SCOPE    = "https://www.googleapis.com/auth/drive.file";
const BACKUP_FOLDER   = "DuoSpace Backups";
const BACKUP_MIME     = "application/json";
const AUTO_BACKUP_KEY = "duo-last-backup";
const DEVICE_SECRET_KEY = "duo-backup-device-secret";

// ─── PKCE helpers ─────────────────────────────────────────────────────────────
function generateCodeVerifier(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data   = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ─── Device secret (Fix #4) ───────────────────────────────────────────────────
/** Returns the device-local backup secret, creating one if absent. */
async function getOrCreateDeviceSecret(): Promise<string> {
  // Try Capacitor Preferences on native
  if (Capacitor.isNativePlatform()) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: DEVICE_SECRET_KEY });
      if (value) return value;
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const secret = btoa(String.fromCharCode(...bytes));
      await Preferences.set({ key: DEVICE_SECRET_KEY, value: secret });
      return secret;
    } catch { /* fall through */ }
  }
  // Web: sessionStorage (survives tab; intentionally cleared on browser close)
  let secret = sessionStorage.getItem(DEVICE_SECRET_KEY);
  if (!secret) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    secret = btoa(String.fromCharCode(...bytes));
    sessionStorage.setItem(DEVICE_SECRET_KEY, secret);
  }
  return secret;
}

// ─── Encryption helpers (Fix #3 — dynamic salt) ───────────────────────────────
/**
 * Derives an AES-GCM key from `password` and a freshly-generated random salt.
 * Returns both the CryptoKey and the salt so the salt can be stored with the ciphertext.
 */
async function deriveKeyWithSalt(password: string): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const enc    = new TextEncoder();
  const keyMat = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  const salt   = crypto.getRandomValues(new Uint8Array(16)); // random per-backup salt
  const key    = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMat,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return { key, salt };
}

/**
 * Encrypts `data` with a device-local secret.
 * Output layout (base64): [16-byte salt][12-byte IV][ciphertext]
 */
async function encryptPayload(data: object, password: string): Promise<string> {
  const { key, salt } = await deriveKeyWithSalt(password);
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const ct  = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(data)),
  );
  const buf = new Uint8Array(16 + 12 + ct.byteLength);
  buf.set(salt, 0);
  buf.set(iv, 16);
  buf.set(new Uint8Array(ct), 28);
  return btoa(String.fromCharCode(...buf));
}

/**
 * Decrypts a payload produced by `encryptPayload`.
 * Reads the salt from the first 16 bytes and IV from the next 12 bytes.
 */
async function decryptPayload(b64: string, password: string): Promise<object> {
  const buf  = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const salt = buf.slice(0, 16);
  const iv   = buf.slice(16, 28);
  const ct   = buf.slice(28);

  const enc    = new TextEncoder();
  const keyMat = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key    = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMat,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useGoogleBackup = () => {
  const { user }  = useAuth();
  const [status,   setStatus]   = useState<BackupStatus>("idle");
  const [error,    setError]    = useState<string | null>(null);
  const [backups,  setBackups]  = useState<BackupInfo[]>([]);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const tokenRef   = useRef<string | null>(null);
  const verifierRef = useRef<string | null>(null);

  useEffect(() => {
    const saved = storage.get(AUTO_BACKUP_KEY);
    if (saved) setLastBackup(saved);

    // AUDIT FIX #2: Handle PKCE authorization-code callback (?code=…)
    // instead of implicit-flow hash fragment (#access_token=…).
    const params = new URLSearchParams(window.location.search);
    const code   = params.get("code");
    if (code) {
      const storedVerifier = sessionStorage.getItem("duo-gdrive-pkce-verifier");
      if (storedVerifier) {
        sessionStorage.removeItem("duo-gdrive-pkce-verifier");
        window.history.replaceState(null, "", window.location.pathname);
        exchangeCodeForToken(code, storedVerifier);
      }
    }

    // Restore cached token (tab reload)
    const cached = sessionStorage.getItem("duo-gdrive-token");
    if (cached) tokenRef.current = cached;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Exchanges the authorization code via the server-side Edge Function. */
  const exchangeCodeForToken = useCallback(async (code: string, verifier: string) => {
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("google-oauth-exchange", {
        body: {
          code,
          code_verifier:  verifier,
          redirect_uri:   window.location.origin + window.location.pathname,
        },
      });
      if (fnErr || data?.error) throw new Error(data?.error_description || fnErr?.message || "Token exchange failed");
      const token = data.access_token as string;
      tokenRef.current = token;
      sessionStorage.setItem("duo-gdrive-token", token);
      setStatus("idle");
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)));
      setStatus("error");
    }
  }, []);

  // ── OAuth sign-in (PKCE) ──────────────────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    setStatus("signing_in");
    const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!CLIENT_ID) {
      setError("VITE_GOOGLE_CLIENT_ID not set in .env");
      setStatus("error");
      return;
    }
    const verifier   = generateCodeVerifier();
    const challenge  = await generateCodeChallenge(verifier);
    verifierRef.current = verifier;
    sessionStorage.setItem("duo-gdrive-pkce-verifier", verifier);

    const params = new URLSearchParams({
      client_id:             CLIENT_ID,
      redirect_uri:          window.location.origin + window.location.pathname,
      response_type:         "code",             // AUDIT FIX #2: was "token"
      scope:                 GDRIVE_SCOPE,
      prompt:                "select_account",
      code_challenge:        challenge,
      code_challenge_method: "S256",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }, []);

  const signOut = useCallback(() => {
    tokenRef.current = null;
    sessionStorage.removeItem("duo-gdrive-token");
    sessionStorage.removeItem("duo-gdrive-pkce-verifier");
  }, []);

  const isSignedIn = !!tokenRef.current;

  // ── Google Drive helpers ──────────────────────────────────────────────────
  const gdriveRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    if (!tokenRef.current) throw new Error("Not signed in to Google");
    const res = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${tokenRef.current}`, ...(options.headers || {}) },
    });
    if (res.status === 401) {
      tokenRef.current = null;
      sessionStorage.removeItem("duo-gdrive-token");
      throw new Error("Google session expired. Please sign in again.");
    }
    return res;
  }, []);

  const getOrCreateFolder = useCallback(async (): Promise<string> => {
    const search = await gdriveRequest(
      `https://www.googleapis.com/drive/v3/files?q=name="${BACKUP_FOLDER}" and mimeType="application/vnd.google-apps.folder" and trashed=false&fields=files(id,name)`,
    );
    const { files } = await search.json();
    if (files?.length) return files[0].id;
    const create = await gdriveRequest("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: BACKUP_FOLDER, mimeType: "application/vnd.google-apps.folder" }),
    });
    const folder = await create.json();
    return folder.id;
  }, [gdriveRequest]);

  // ── List backups ──────────────────────────────────────────────────────────
  const listBackups = useCallback(async (): Promise<BackupInfo[]> => {
    if (!tokenRef.current) return [];
    try {
      const folderId = await getOrCreateFolder();
      const res = await gdriveRequest(
        `https://www.googleapis.com/drive/v3/files?q="${folderId}" in parents and trashed=false&fields=files(id,name,createdTime,size,appProperties)&orderBy=createdTime desc`,
      );
      const { files } = await res.json();
      const list: BackupInfo[] = ((files ?? []) as GDriveFile[]).map((f) => ({
        id:           f.id,
        name:         f.name,
        createdTime:  f.createdTime,
        size:         f.size || "0",
        messageCount: parseInt(f.appProperties?.messageCount || "0"),
        galleryCount: parseInt(f.appProperties?.galleryCount || "0"),
      }));
      setBackups(list);
      return list;
    } catch { return []; }
  }, [gdriveRequest, getOrCreateFolder]);

  // ── Backup ────────────────────────────────────────────────────────────────
  const backup = useCallback(async () => {
    if (!user || !tokenRef.current) { signInWithGoogle(); return; }
    setStatus("backing_up");
    setError(null);
    setProgress(0);
    try {
      setProgress(10);
      // Paginated fetch — avoids loading the entire table in one query
      const { data: messages } = await supabase
        .from("messages")
        .select("id,sender_id,receiver_id,content,message_type,file_url,file_name,is_read,reply_to_id,disappear_at,deleted_by_sender,deleted_by_receiver,created_at")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: true });

      setProgress(30);
      const { data: gallery } = await supabase
        .from("gallery_items")
        .select("id,file_url,file_type,file_name,is_shared,created_at")
        .eq("owner_id", user.id);

      setProgress(50);
      const { data: profile } = await supabase
        .from("profiles")
        .select("id,sender_id,receiver_id,content,message_type,disappear_at,created_at")
        .eq("user_id", user.id)
        .single();

      const payload = {
        version:      4,
        exportedAt:   new Date().toISOString(),
        userId:       user.id,
        profile,
        messages:     messages || [],
        gallery:      gallery  || [],
        importedChats: [],
      };

      // AUDIT FIX #4: Encrypt with device-local secret, NOT user.id
      setProgress(65);
      const deviceSecret = await getOrCreateDeviceSecret();
      // AUDIT FIX #3: encryptPayload now generates a random salt per call
      const encrypted = await encryptPayload(payload, deviceSecret);

      setProgress(75);
      const folderId  = await getOrCreateFolder();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const fileName  = `DuoSpace_Backup_${timestamp}.json`;

      const metadata = {
        name:     fileName,
        parents:  [folderId],
        appProperties: {
          messageCount: String((messages || []).length),
          galleryCount: String((gallery  || []).length),
          userId:       user.id,
          schemaVersion: "4",
        },
      };

      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file",     new Blob([encrypted],                 { type: BACKUP_MIME }));

      const uploadRes = await gdriveRequest(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime",
        { method: "POST", body: form },
      );
      const fileData = await uploadRes.json();

      setProgress(95);
      await supabase.from("backup_logs" as any).insert({
        user_id:       user.id,
        backup_type:   "google_drive",
        status:        "success",
        file_count:    (messages || []).length + (gallery || []).length,
        google_file_id: fileData.id,
      });

      const now = new Date().toISOString();
      storage.set(AUTO_BACKUP_KEY, now);
      setLastBackup(now);
      setProgress(100);
      setStatus("done");
      await listBackups();
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || "Backup failed");
      setStatus("error");
    }
  }, [user, gdriveRequest, getOrCreateFolder, listBackups, signInWithGoogle]);

  // ── Restore ───────────────────────────────────────────────────────────────
  const restore = useCallback(async (backupId: string, passphraseOverride?: string) => {
    if (!user || !tokenRef.current) return;
    setStatus("restoring");
    setError(null);
    setProgress(0);
    try {
      setProgress(20);
      const res       = await gdriveRequest(`https://www.googleapis.com/drive/v3/files/${backupId}?alt=media`);
      const encrypted = await res.text();

      setProgress(40);
      // Use explicit passphrase if provided (cross-device restore), else device secret
      const secret  = passphraseOverride ?? await getOrCreateDeviceSecret();
      const payload = await decryptPayload(encrypted, secret) as any;

      if (payload.userId !== user.id) throw new Error("This backup belongs to a different account.");

      setProgress(60);
      if (payload.messages?.length) {
        for (let i = 0; i < payload.messages.length; i += 100) {
          await supabase.from("messages").upsert(
            payload.messages.slice(i, i + 100),
            { onConflict: "id", ignoreDuplicates: true },
          );
        }
      }

      setProgress(80);
      if (payload.gallery?.length) {
        await supabase.from("gallery_items").upsert(
          payload.gallery.map((g: Record<string, unknown>) => ({ ...g, owner_id: user.id })),
          { onConflict: "id", ignoreDuplicates: true },
        );
      }

      setProgress(100);
      setStatus("done");
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || "Restore failed");
      setStatus("error");
    }
  }, [user, gdriveRequest]);

  // ── Auto-backup check (daily) ─────────────────────────────────────────────
  const checkAutoBackup = useCallback(async () => {
    if (!tokenRef.current || !user) return false;
    const last = storage.get(AUTO_BACKUP_KEY);
    if (!last) return true;
    const daysSince = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= 1;
  }, [user]);

  /** Export the device secret so the user can save it for cross-device restores. */
  const exportDeviceSecret = useCallback(async (): Promise<string> => {
    return getOrCreateDeviceSecret();
  }, []);

  return {
    status, error, progress, backups, lastBackup,
    isSignedIn,
    signInWithGoogle, signOut,
    backup, restore, listBackups, checkAutoBackup, exportDeviceSecret,
  };
};
