-- B5: Room-linked satisfaction surveys on feedback table

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS feedback_room_created_idx
  ON feedback (room_id, created_at DESC)
  WHERE room_id IS NOT NULL;

ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_kind_check;
ALTER TABLE feedback
  ADD CONSTRAINT feedback_kind_check
    CHECK (kind IN ('feedback', 'bug', 'feature', 'satisfaction'));
