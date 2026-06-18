-- AI / human review for plaza posts; report queue for manual follow-up.

ALTER TABLE play_plaza_posts
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS ai_review_note text,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

UPDATE play_plaza_posts
SET review_status = 'approved',
    published_at = COALESCE(published_at, created_at)
WHERE published_at IS NULL;

ALTER TABLE play_plaza_posts DROP CONSTRAINT IF EXISTS play_plaza_posts_review_status_check;
ALTER TABLE play_plaza_posts
  ADD CONSTRAINT play_plaza_posts_review_status_check
  CHECK (review_status IN ('pending', 'approved', 'rejected', 'human_review'));

CREATE INDEX IF NOT EXISTS idx_play_plaza_posts_review ON play_plaza_posts (review_status, created_at DESC);

ALTER TABLE play_plaza_reports
  ADD COLUMN IF NOT EXISTS human_review_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS ops_note text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE play_plaza_reports DROP CONSTRAINT IF EXISTS play_plaza_reports_human_review_status_check;
ALTER TABLE play_plaza_reports
  ADD CONSTRAINT play_plaza_reports_human_review_status_check
  CHECK (human_review_status IN ('open', 'resolved', 'dismissed'));

CREATE INDEX IF NOT EXISTS idx_play_plaza_reports_open ON play_plaza_reports (human_review_status, created_at DESC);
