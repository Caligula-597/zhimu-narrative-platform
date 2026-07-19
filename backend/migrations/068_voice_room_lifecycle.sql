ALTER TABLE voice_rooms
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Private rooms are explicitly temporary. Give legacy private rooms a grace
-- period instead of making them disappear immediately at migration time.
UPDATE voice_rooms
SET expires_at = now() + interval '24 hours'
WHERE room_type = 'invite_private' AND status = 'active' AND expires_at IS NULL;
