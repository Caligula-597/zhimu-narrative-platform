-- Current PlayableProject JSON blob per world (P7.0 compile asset; not a session).
CREATE TABLE world_playable_projects (
  world_id uuid PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  project jsonb NOT NULL,
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(project) = 'object')
);

CREATE INDEX world_playable_projects_updated_at_idx
  ON world_playable_projects (updated_at DESC);

COMMENT ON TABLE world_playable_projects IS
  'Per-world current PlayableProject (P7 compile output). Running rooms must pin snapshot at session start.';
COMMENT ON COLUMN world_playable_projects.project IS
  'Normalized PlayableProject JSON (shared/playable-project-contracts).';
