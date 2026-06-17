-- Public lobby: hosts may list a parallel room on play.getzhimu.com for strangers to discover.
-- Distinct from world catalog_public (approved script library) and invite-only rooms.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS public_listing boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN rooms.public_listing IS
  'When true, room is visible in the player portal public lobby (invite code still required to join).';

CREATE INDEX IF NOT EXISTS idx_rooms_public_listing_active
  ON rooms (updated_at DESC)
  WHERE public_listing = true;
