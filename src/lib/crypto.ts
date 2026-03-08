// E2E Encryption using ECDH key exchange + AES-GCM
// Keys are generated client-side. Only the public key is stored in the database.
// The shared secret is derived locally and never leaves the device.

const ALGO = { name: "ECDH", namedCurve: "P-256" };
const AES = { name: "AES-GCM", length: 256 };
const DB_KEY = "duo_e2e_keypair";

function ab2b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b642ab(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

export async function generateKeyPair(): Promise<{ publicKey: string; privateKeyJwk: JsonWebKey }> {
  const pair = await crypto.subtle.generateKey(ALGO, true, ["deriveKey"]);
  const pubRaw = await crypto.subtle.exportKey("raw", pair.publicKey);
  const privJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicKey: ab2b64(pubRaw), privateKeyJwk: privJwk };
}

export function saveKeyPair(userId: string, privateKeyJwk: JsonWebKey, publicKey: string) {
  localStorage.setItem(`${DB_KEY}_${userId}`, JSON.stringify({ privateKeyJwk, publicKey }));
}

export function loadKeyPair(userId: string): { privateKeyJwk: JsonWebKey; publicKey: string } | null {
  const raw = localStorage.getItem(`${DB_KEY}_${userId}`);
  if (!raw) return null;
  return JSON.parse(raw);
}

async function deriveKey(privateKeyJwk: JsonWebKey, partnerPublicKeyB64: string): Promise<CryptoKey> {
  const privateKey = await crypto.subtle.importKey("jwk", privateKeyJwk, ALGO, false, ["deriveKey"]);
  const partnerPublicKey = await crypto.subtle.importKey("raw", b642ab(partnerPublicKeyB64), ALGO, false, []);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: partnerPublicKey },
    privateKey,
    AES,
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(
  text: string,
  privateKeyJwk: JsonWebKey,
  partnerPublicKeyB64: string
): Promise<string> {
  const key = await deriveKey(privateKeyJwk, partnerPublicKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  // Format: base64(iv):base64(ciphertext)
  return `${ab2b64(iv.buffer)}:${ab2b64(ciphertext)}`;
}

export async function decryptMessage(
  encrypted: string,
  privateKeyJwk: JsonWebKey,
  partnerPublicKeyB64: string
): Promise<string> {
  try {
    const [ivB64, ctB64] = encrypted.split(":");
    if (!ivB64 || !ctB64) return encrypted; // Not encrypted, return as-is
    const key = await deriveKey(privateKeyJwk, partnerPublicKeyB64);
    const iv = new Uint8Array(b642ab(ivB64));
    const ciphertext = b642ab(ctB64);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    return "[🔒 Cannot decrypt]";
  }
}

export function isEncrypted(content: string | null): boolean {
  if (!content) return false;
  // Encrypted messages have format base64:base64
  const parts = content.split(":");
  if (parts.length !== 2) return false;
  try {
    atob(parts[0]);
    atob(parts[1]);
    return parts[0].length >= 16; // IV is at least 16 chars in base64
  } catch {
    return false;
  }
}
