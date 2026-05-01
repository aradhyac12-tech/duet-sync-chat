-- ============================================================
-- DuoSpace v3 — Bug-Fix & Feature Migration
-- Covers: message editing, pinning, nudge type,
--         atomic partner-request acceptance, scheduled-message cron setup
-- ============================================================

-- ── Message editing ──────────────────────────────────────────
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for quick pinned-message lookup
CREATE INDEX IF NOT EXISTS messages_pinned_idx
  ON messages (sender_id, receiver_id)
  WHERE is_pinned = TRUE;

-- ── Atomic partner-request acceptance ────────────────────────
-- FIX: replaces the two non-atomic profile updates in the client
CREATE OR REPLACE FUNCTION accept_partner_request(p_request_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_id UUID;
BEGIN
  -- Validate and fetch request
  SELECT sender_id INTO v_sender_id
  FROM partner_requests
  WHERE id = p_request_id
    AND receiver_id = p_user_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Mark accepted
  UPDATE partner_requests SET status = 'accepted' WHERE id = p_request_id;

  -- Clear any existing partner links first (atomic)
  UPDATE profiles SET partner_id = NULL
  WHERE user_id IN (p_user_id, v_sender_id);

  -- Link both sides
  UPDATE profiles SET partner_id = v_sender_id WHERE user_id = p_user_id;
  UPDATE profiles SET partner_id = p_user_id   WHERE user_id = v_sender_id;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_partner_request(UUID, UUID) TO authenticated;

-- ── Ensure partner_requests table has receiver_id index ──────
CREATE INDEX IF NOT EXISTS partner_requests_receiver_idx
  ON partner_requests (receiver_id, status);

-- ── Nudge message type — just a comment, no DDL needed ───────
-- message_type 'nudge' is stored as text; no ENUM constraint

-- ── Scheduled messages cron setup reminder ───────────────────
-- Run this in Supabase SQL Editor after deploying the edge function:
--
-- SELECT cron.schedule(
--   'deliver-scheduled',
--   '* * * * *',
--   $$
--     SELECT net.http_post(
--       url    := 'https://YOUR_PROJECT.supabase.co/functions/v1/deliver-scheduled-messages',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
--       )
--     ) AS request_id
--   $$
-- );
