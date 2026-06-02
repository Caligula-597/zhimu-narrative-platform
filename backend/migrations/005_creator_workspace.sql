ALTER TABLE chapters
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'testing', 'published')),
  ADD COLUMN IF NOT EXISTS unlock_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE script_sections
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'testing', 'published')),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  label text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_versions_world_created_idx
  ON content_versions(world_id, created_at DESC);
