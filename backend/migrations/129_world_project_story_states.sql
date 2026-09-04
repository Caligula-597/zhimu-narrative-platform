-- One ProjectStoryState JSON blob per world (STORY mechanism basket persistence).
CREATE TABLE world_project_story_states (
  world_id uuid PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  state jsonb NOT NULL,
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(state) = 'object')
);

CREATE INDEX world_project_story_states_updated_at_idx
  ON world_project_story_states (updated_at DESC);

COMMENT ON TABLE world_project_story_states IS
  'Per-world ProjectStoryState for STORY mechanism basket (blocks, roleAssignments, revision).';
COMMENT ON COLUMN world_project_story_states.state IS
  'Normalized ProjectStoryState JSON (shared/story-mechanism-contracts).';
