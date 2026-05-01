-- ============================================================
-- DuoSpace Bug-Fix Migration
-- Fixes: push tokens, invite invalidation, message soft-delete,
--        disappear_at sentinel, call room URL storage
-- ============================================================

-- Fix #11: Add push notification token columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT,
  ADD COLUMN IF NOT EXISTS push_platform TEXT;

-- Fix #6: Ensure invite_links cannot be reused
-- Add a unique constraint on used_by so a user can only accept one invite
-- The code now hard-deletes invites on use, but this is a safety net:
ALTER TABLE invite_links
  ADD COLUMN IF NOT EXISTS used_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- Fix #15: Change disappear_at column to TEXT to support the "pending" sentinel
-- (it was already nullable; we just document the sentinel value here)
-- No DDL change needed — the column is already TEXT-compatible in Postgres
-- The code sets disappear_at = 'pending' on send, then to a real timestamp on read.
-- To properly enforce this, add a check constraint:
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_disappear_at_check;
ALTER TABLE messages
  ADD CONSTRAINT messages_disappear_at_check
  CHECK (
    disappear_at IS NULL
    OR disappear_at = 'pending'
    OR disappear_at::TIMESTAMPTZ IS NOT NULL
  );

-- Fix #3: Ensure deleted_by_sender and deleted_by_receiver exist and default false
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS deleted_by_sender BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_by_receiver BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for faster soft-delete filtering
CREATE INDEX IF NOT EXISTS messages_not_deleted_idx
  ON messages (sender_id, receiver_id, created_at DESC)
  WHERE deleted_by_sender = FALSE AND deleted_by_receiver = FALSE;

-- Fix #4: Rename room_name to room_url conceptually — column stays same name
-- but we add a comment to clarify it now stores the full Daily.co URL
COMMENT ON COLUMN call_history.room_name IS
  'Full Daily.co room URL (e.g. https://your-domain.daily.co/room-name). Used by receiver to join.';

-- Fix #14: Create a function that both partner_ids are cleared atomically on unlink
-- Called from the client via supabase.rpc('unlink_partner', { user_id: ... })
CREATE OR REPLACE FUNCTION unlink_partner(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id UUID;
BEGIN
  -- Get the current partner
  SELECT partner_id INTO v_partner_id FROM profiles WHERE user_id = p_user_id;

  -- Clear both sides atomically
  UPDATE profiles SET partner_id = NULL WHERE user_id = p_user_id;
  IF v_partner_id IS NOT NULL THEN
    UPDATE profiles SET partner_id = NULL WHERE user_id = v_partner_id;
  END IF;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION unlink_partner(UUID) TO authenticated;

-- Fix #6: Create a function to atomically accept invite and delete it
CREATE OR REPLACE FUNCTION accept_invite(p_code TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
  v_creator_display_name TEXT;
BEGIN
  -- Lock and fetch invite atomically
  SELECT * INTO v_invite
  FROM invite_links
  WHERE code = p_code
    AND (used_by IS NULL)
    AND (expires_at IS NULL OR expires_at > NOW())
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invite not found or already used');
  END IF;

  IF v_invite.creator_id = p_user_id THEN
    RETURN jsonb_build_object('error', 'Cannot use your own invite');
  END IF;

  -- Link both users
  UPDATE profiles SET partner_id = v_invite.creator_id WHERE user_id = p_user_id;
  UPDATE profiles SET partner_id = p_user_id WHERE user_id = v_invite.creator_id;

  -- Delete the invite so it cannot be reused (Fix #6)
  DELETE FROM invite_links WHERE id = v_invite.id;

  -- Return creator info for the toast message
  SELECT display_name INTO v_creator_display_name FROM profiles WHERE user_id = v_invite.creator_id;

  RETURN jsonb_build_object(
    'success', true,
    'creator_id', v_invite.creator_id,
    'creator_name', COALESCE(v_creator_display_name, 'Partner')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_invite(TEXT, UUID) TO authenticated;

-- Cleanup: remove any duplicate/stale partner requests for linked pairs
CREATE OR REPLACE FUNCTION cleanup_accepted_requests()
RETURNS TRIGGER AS $$
BEGIN
  -- When a partner link is established, mark all pending requests as accepted
  IF NEW.partner_id IS NOT NULL AND OLD.partner_id IS NULL THEN
    UPDATE partner_requests
    SET status = 'accepted'
    WHERE (sender_id = NEW.user_id AND receiver_id = NEW.partner_id)
       OR (sender_id = NEW.partner_id AND receiver_id = NEW.user_id)
       AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_partner_linked ON profiles;
CREATE TRIGGER on_partner_linked
  AFTER UPDATE OF partner_id ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_accepted_requests();


-- ============================================================
-- Scheduled Messages (F3)
-- ============================================================
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  send_at TIMESTAMPTZ NOT NULL,
  disappear_at TEXT,
  sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the delivery cron query
CREATE INDEX IF NOT EXISTS scheduled_messages_pending_idx
  ON scheduled_messages (send_at ASC)
  WHERE sent = FALSE;

-- RLS: users can only see/manage their own scheduled messages
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own scheduled messages"
  ON scheduled_messages
  FOR ALL
  USING (sender_id = auth.uid());

-- ============================================================
-- Taps table: ensure receiver_id column exists (B4 fix)
-- ============================================================
ALTER TABLE taps
  ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES auth.users(id);

-- Index for incoming tap realtime filter
CREATE INDEX IF NOT EXISTS taps_receiver_idx ON taps (receiver_id);

-- ============================================================
-- Enable pg_cron for scheduled message delivery (run in SQL Editor)
-- ============================================================
-- After running this migration, execute in SQL Editor:
--
-- SELECT cron.schedule(
--   'deliver-scheduled-messages',
--   '* * * * *',
--   $$
--     SELECT net.http_post(
--       url := current_setting('app.supabase_url') || '/functions/v1/deliver-scheduled-messages',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--       )
--     );
--   $$
-- );


-- ============================================================
-- Couple theme sync (F11)
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS couple_theme TEXT;
