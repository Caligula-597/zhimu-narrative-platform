-- Keep reply moderation semantics aligned with plaza posts. Replies that need
-- human review remain visible only to their author until an operator approves.

ALTER TABLE play_plaza_replies
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS ai_review_note text,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

UPDATE play_plaza_replies
SET review_status = 'approved',
    published_at = COALESCE(published_at, created_at)
WHERE published_at IS NULL;

ALTER TABLE play_plaza_replies
  DROP CONSTRAINT IF EXISTS play_plaza_replies_review_status_check;

ALTER TABLE play_plaza_replies
  ADD CONSTRAINT play_plaza_replies_review_status_check
  CHECK (review_status IN ('pending', 'approved', 'rejected', 'human_review'));

CREATE INDEX IF NOT EXISTS idx_play_plaza_replies_review
  ON play_plaza_replies (review_status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_play_plaza_replies_visible
  ON play_plaza_replies (post_id, created_at ASC)
  WHERE deleted_at IS NULL AND review_status = 'approved';
