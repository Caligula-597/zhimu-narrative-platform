-- User feedback / bug reports / feature requests (P1 公开 Beta 自助闭环)

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'feedback',
  subject text NOT NULL,
  body text NOT NULL,
  page_url text,
  user_agent text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_kind_check
    CHECK (kind IN ('feedback', 'bug', 'feature')),
  CONSTRAINT feedback_status_check
    CHECK (status IN ('new', 'seen', 'resolved'))
);

CREATE INDEX IF NOT EXISTS feedback_status_created_idx
  ON feedback (status, created_at DESC);

CREATE INDEX IF NOT EXISTS feedback_kind_created_idx
  ON feedback (kind, created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
