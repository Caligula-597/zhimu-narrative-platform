-- Backward-compatible room-to-release binding seam.
-- NULL keeps every existing room on the legacy live-draft read path until the
-- RuntimeContentProvider migration is complete.

ALTER TABLE rooms
  ADD COLUMN release_id uuid;

ALTER TABLE rooms
  ADD CONSTRAINT rooms_world_release_fk
  FOREIGN KEY (world_id, release_id)
  REFERENCES world_releases(world_id, id)
  ON DELETE RESTRICT;

CREATE INDEX rooms_release_id_idx
  ON rooms(release_id)
  WHERE release_id IS NOT NULL;

COMMENT ON COLUMN rooms.release_id IS
  'Optional immutable authored Release selected for this room. Until the release RuntimeContentProvider is enabled, APIs must report runtimeSource=live_draft and isFrozen=false.';
