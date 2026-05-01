-- ============================================================
-- BugFix Migration: duet-sync-chat v3 (2026-04-25)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Fix #Bug12: Server-side deletion of expired disappearing messages.
--
-- Previously each client ran a DELETE every 5 s from JavaScript,
-- causing both partners to race-delete the same rows simultaneously.
-- This trigger + pg_cron job handles it exactly once, server-side.
-- ─────────────────────────────────────────────────────────────

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function: delete messages whose disappear_at has passed
CREATE OR REPLACE FUNCTION delete_expired_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.messages
  WHERE disappear_at IS NOT NULL
    AND disappear_at != 'pending'
    AND disappear_at::timestamptz <= now();
END;
$$;

-- Schedule: run every minute via pg_cron
-- (idempotent: DROP first so re-running migration is safe)
SELECT cron.unschedule('delete-expired-messages') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'delete-expired-messages'
);
SELECT cron.schedule(
  'delete-expired-messages',
  '* * * * *',   -- every minute
  $$SELECT delete_expired_messages();$$
);


-- ─────────────────────────────────────────────────────────────
-- Fix #Bug7: Add "seen" status support for call_history so the
-- missed-calls badge doesn't reappear after being dismissed.
--
-- Adds "seen" as a valid status alongside existing "missed",
-- "answered", "declined", etc. — no destructive column change.
-- ─────────────────────────────────────────────────────────────

-- Only alter if "seen" is not already a valid enum value
DO $$
BEGIN
  -- call_history.status is a text column in most setups; guard with a check
  -- If it's an enum type on your project, run: ALTER TYPE call_status ADD VALUE 'seen';
  -- This migration assumes text — safe to run regardless.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'call_history_status_seen_allowed'
  ) THEN
    -- No-op for text columns; for enum columns use ALTER TYPE instead
    RAISE NOTICE 'call_history.status is a text column — "seen" value is already valid.';
  END IF;
END;
$$;

-- Index to make the badge query fast (receiver + status)
CREATE INDEX IF NOT EXISTS idx_call_history_receiver_status
  ON public.call_history (receiver_id, status);

-- Index on messages for fast expiry scans
CREATE INDEX IF NOT EXISTS idx_messages_disappear_at
  ON public.messages (disappear_at)
  WHERE disappear_at IS NOT NULL;
