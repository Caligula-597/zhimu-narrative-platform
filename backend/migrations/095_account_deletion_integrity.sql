-- Preserve collaborative runtime records while allowing a user to exercise
-- account deletion. Authorship becomes anonymous instead of blocking DELETE.

ALTER TABLE notebook_entries
  ALTER COLUMN created_by_user_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS notebook_entries_created_by_user_id_fkey,
  ADD CONSTRAINT notebook_entries_created_by_user_id_fkey
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE checkpoints
  ALTER COLUMN created_by_user_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS checkpoints_created_by_user_id_fkey,
  ADD CONSTRAINT checkpoints_created_by_user_id_fkey
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE content_versions
  ALTER COLUMN created_by_user_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS content_versions_created_by_user_id_fkey,
  ADD CONSTRAINT content_versions_created_by_user_id_fkey
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE room_recaps
  ALTER COLUMN created_by_user_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS room_recaps_created_by_user_id_fkey,
  ADD CONSTRAINT room_recaps_created_by_user_id_fkey
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS notebook_entries_created_by_user_idx
  ON notebook_entries(created_by_user_id)
  WHERE created_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS checkpoints_created_by_user_idx
  ON checkpoints(created_by_user_id)
  WHERE created_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS content_versions_created_by_user_idx
  ON content_versions(created_by_user_id)
  WHERE created_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS room_recaps_created_by_user_idx
  ON room_recaps(created_by_user_id)
  WHERE created_by_user_id IS NOT NULL;
