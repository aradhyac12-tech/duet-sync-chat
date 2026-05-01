-- =============================================================================
-- FIX #14: Migration naming and squash note
-- =============================================================================
-- This project has 20 migrations, 4 of which are named generically:
--   20260412000001_bugfixes.sql
--   20260420000001_v3_fixes.sql
--   20260425000001_bugfixes_v3.sql   ← this file
--   20260430000001_audit_fixes.sql   ← this file
--
-- For a fresh deployment, squash into a single `00000000000000_init.sql` using:
--   supabase db dump --local > supabase/migrations/00000000000000_init.sql
-- then delete the 20 individual files. This is only safe on a brand-new DB;
-- never squash on a live production instance that has already applied them.
--
-- Going forward: name migrations descriptively, e.g.
--   20260501000001_add_reactions_table.sql
--   20260502000001_add_rls_to_locations.sql
-- =============================================================================

-- AUDIT FIX: claim_pending_scheduled_messages helper
-- Atomically marks pending messages as in-processing and returns them.
-- Used by the deliver-scheduled-messages edge function to prevent duplicate sends.
CREATE OR REPLACE FUNCTION claim_pending_scheduled_messages()
RETURNS SETOF scheduled_messages
LANGUAGE sql
AS $$
  UPDATE scheduled_messages
  SET    is_processing = true
  WHERE  sent          = false
    AND  is_processing = false
    AND  send_at       <= NOW()
  RETURNING *;
$$;

-- Ensure the is_processing column exists (idempotent via IF NOT EXISTS)
ALTER TABLE scheduled_messages
  ADD COLUMN IF NOT EXISTS is_processing BOOLEAN NOT NULL DEFAULT false;
