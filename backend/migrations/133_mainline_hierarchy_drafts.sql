CREATE TABLE IF NOT EXISTS mainline_hierarchy_drafts (
  world_id uuid PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1 CHECK (version = 1),
  draft jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(draft) = 'object'),
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
