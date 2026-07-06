-- B4: Faceted catalog tags per world

CREATE TABLE IF NOT EXISTS world_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  tag_key text NOT NULL,
  tag_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, tag_key, tag_value)
);

CREATE INDEX IF NOT EXISTS world_tags_key_value_idx
  ON world_tags (tag_key, tag_value);

CREATE INDEX IF NOT EXISTS world_tags_world_idx
  ON world_tags (world_id);

ALTER TABLE world_tags ENABLE ROW LEVEL SECURITY;
