CREATE TABLE IF NOT EXISTS story_manuscripts (
  world_id uuid PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  last_sync_direction text NOT NULL DEFAULT 'manual'
    CHECK (last_sync_direction IN ('manual', 'graph_to_manuscript', 'manuscript_to_graph')),
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
