-- Physical token extensions: creator labels, integration metadata (e.g. tump), expiry.

ALTER TABLE physical_tokens
  ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_physical_tokens_world_status
  ON physical_tokens(world_id, status);

CREATE INDEX IF NOT EXISTS idx_physical_tokens_world_content
  ON physical_tokens(world_id, content_type, content_id);
