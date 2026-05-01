-- =============================================================================
-- Migration: RLS Comprehensive Audit & Hardening
-- FIX AUDIT #7: Every new table or migration can reopen data leaks.
-- This migration re-audits and re-applies RLS on all tables, adds missing
-- policies, and documents the intent of each policy for future reviewers.
--
-- Pattern: Each table gets a policy comment block explaining:
--   1. Who can SELECT/INSERT/UPDATE/DELETE
--   2. Why (data sensitivity level)
--   3. Any edge cases to watch
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Ensure RLS is ON for every user-data table.
-- This is idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.message_reactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.imported_chats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.locations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.memory_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.anniversaries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.playlists          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shayari            ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: messages
-- Sensitivity: HIGH — contains E2E encrypted message content
-- Policy: users can only read messages they sent or received.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages_select_own" ON public.messages;
CREATE POLICY "messages_select_own" ON public.messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
CREATE POLICY "messages_insert_own" ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE
  USING (
    -- Senders can edit/delete their own messages
    auth.uid() = sender_id
    OR
    -- Receivers can mark messages as read or set disappear_at
    auth.uid() = receiver_id
  );

DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;
CREATE POLICY "messages_delete_own" ON public.messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: profiles
-- Sensitivity: MEDIUM — display names, avatars, partner links, public_key
-- Policy: any authenticated user can read any profile (needed for partner lookup),
--   but users can only write their own profile.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: call_history
-- Sensitivity: HIGH — call timestamps and durations
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "call_history_select_participant" ON public.call_history;
CREATE POLICY "call_history_select_participant" ON public.call_history
  FOR SELECT
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "call_history_insert_caller" ON public.call_history;
CREATE POLICY "call_history_insert_caller" ON public.call_history
  FOR INSERT
  WITH CHECK (auth.uid() = caller_id);

DROP POLICY IF EXISTS "call_history_update_participant" ON public.call_history;
CREATE POLICY "call_history_update_participant" ON public.call_history
  FOR UPDATE
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: scheduled_messages
-- Sensitivity: HIGH — future message content
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "scheduled_messages_select_own" ON public.scheduled_messages;
CREATE POLICY "scheduled_messages_select_own" ON public.scheduled_messages
  FOR SELECT
  USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "scheduled_messages_insert_own" ON public.scheduled_messages;
CREATE POLICY "scheduled_messages_insert_own" ON public.scheduled_messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "scheduled_messages_delete_own" ON public.scheduled_messages;
CREATE POLICY "scheduled_messages_delete_own" ON public.scheduled_messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: message_reactions
-- Sensitivity: LOW — emoji reactions are not sensitive but must be attributed
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reactions_select_participant" ON public.message_reactions;
CREATE POLICY "reactions_select_participant" ON public.message_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "reactions_insert_own" ON public.message_reactions;
CREATE POLICY "reactions_insert_own" ON public.message_reactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reactions_delete_own" ON public.message_reactions;
CREATE POLICY "reactions_delete_own" ON public.message_reactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: imported_chats
-- Sensitivity: HIGH — imported private chat history
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "imported_chats_select_owner" ON public.imported_chats;
CREATE POLICY "imported_chats_select_owner" ON public.imported_chats
  FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "imported_chats_insert_owner" ON public.imported_chats;
CREATE POLICY "imported_chats_insert_owner" ON public.imported_chats
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "imported_chats_delete_owner" ON public.imported_chats;
CREATE POLICY "imported_chats_delete_owner" ON public.imported_chats
  FOR DELETE
  USING (auth.uid() = owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: locations
-- Sensitivity: VERY HIGH — GPS coordinates; only visible between partners
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "locations_select_partner" ON public.locations;
CREATE POLICY "locations_select_partner" ON public.locations
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.partner_id = locations.user_id
    )
  );

DROP POLICY IF EXISTS "locations_insert_own" ON public.locations;
CREATE POLICY "locations_insert_own" ON public.locations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "locations_update_own" ON public.locations;
CREATE POLICY "locations_update_own" ON public.locations
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Remaining tables: memory_items, anniversaries, playlists, shayari
-- All follow the same "owner-only" pattern.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['memory_items','anniversaries','playlists','shayari']
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_select_own" ON public.%I',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_select_own" ON public.%I FOR SELECT USING (auth.uid() = user_id)',
      tbl, tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_insert_own" ON public.%I',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_insert_own" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)',
      tbl, tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_update_own" ON public.%I',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_update_own" ON public.%I FOR UPDATE USING (auth.uid() = user_id)',
      tbl, tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_delete_own" ON public.%I',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_delete_own" ON public.%I FOR DELETE USING (auth.uid() = user_id)',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT CHECKLIST (run after every new migration):
-- 1. Does the new table have ENABLE ROW LEVEL SECURITY?
-- 2. Is there a SELECT policy restricting reads to the owner/partner?
-- 3. Does the INSERT policy enforce auth.uid() = owner column?
-- 4. Does the UPDATE policy prevent cross-user writes?
-- 5. If table has sensitive data, is there a DELETE policy?
-- ─────────────────────────────────────────────────────────────────────────────
