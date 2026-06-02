CREATE TABLE IF NOT EXISTS story_graph_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  from_type text NOT NULL CHECK (from_type IN ('chapter', 'scene', 'clue', 'investigation_point')),
  from_id uuid NOT NULL,
  to_type text NOT NULL CHECK (to_type IN ('chapter', 'scene', 'clue', 'investigation_point')),
  to_id uuid NOT NULL,
  relation_type text NOT NULL CHECK (relation_type IN ('mainline', 'parallel', 'extension')),
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, from_type, from_id, to_type, to_id, relation_type)
);

CREATE INDEX IF NOT EXISTS story_graph_edges_world_idx
  ON story_graph_edges(world_id, created_at);
