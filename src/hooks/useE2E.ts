import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  generateKeyPair,
  saveKeyPair,
  loadKeyPair,
  encryptMessage,
  decryptMessage,
  isEncrypted,
} from "@/lib/crypto";

export const useE2E = (userId: string | undefined, partnerId: string | null) => {
  const [ready, setReady] = useState(false);
  const [partnerPublicKey, setPartnerPublicKey] = useState<string | null>(null);
  const [myKeys, setMyKeys] = useState<{ privateKeyJwk: JsonWebKey; publicKey: string } | null>(null);

  // Init or load keys
  useEffect(() => {
    if (!userId) return;
    const init = async () => {
      let keys = loadKeyPair(userId);
      if (!keys) {
        const { publicKey, privateKeyJwk } = await generateKeyPair();
        keys = { privateKeyJwk, publicKey };
        saveKeyPair(userId, privateKeyJwk, publicKey);
      }
      // Publish public key to profile
      await supabase
        .from("profiles")
        .update({ public_key: keys.publicKey } as any)
        .eq("user_id", userId);
      setMyKeys(keys);
    };
    init();
  }, [userId]);

  // Fetch partner public key
  useEffect(() => {
    if (!partnerId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("public_key" as any)
        .eq("user_id", partnerId)
        .single();
      if ((data as any)?.public_key) {
        setPartnerPublicKey((data as any).public_key);
        setReady(true);
      }
    };
    fetch();
  }, [partnerId]);

  const encrypt = useCallback(
    async (text: string): Promise<string> => {
      if (!myKeys || !partnerPublicKey) return text;
      return encryptMessage(text, myKeys.privateKeyJwk, partnerPublicKey);
    },
    [myKeys, partnerPublicKey]
  );

  const decrypt = useCallback(
    async (text: string | null): Promise<string> => {
      if (!text) return "";
      if (!isEncrypted(text)) return text;
      if (!myKeys || !partnerPublicKey) return "[🔒 Encrypted]";
      return decryptMessage(text, myKeys.privateKeyJwk, partnerPublicKey);
    },
    [myKeys, partnerPublicKey]
  );

  return { ready: ready && !!myKeys, encrypt, decrypt };
};
