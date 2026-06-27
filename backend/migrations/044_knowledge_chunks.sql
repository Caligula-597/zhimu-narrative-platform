CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('story_manuscript', 'script_section', 'clue', 'scene', 'asset')),
  source_id uuid,
  role_slot_id uuid REFERENCES role_slots(id) ON DELETE SET NULL,
  visibility visibility_scope NOT NULL DEFAULT 'author',
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  title text NOT NULL DEFAULT '',
  body text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, source_type, source_id, role_slot_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_world_source
  ON knowledge_chunks(world_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_world_role_visibility
  ON knowledge_chunks(world_id, role_slot_id, visibility);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_body_trgm
  ON knowledge_chunks USING gin (body gin_trgm_ops);
