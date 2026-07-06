-- B6: Segment-level host remedy script templates

CREATE TABLE IF NOT EXISTS segment_remedies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  segment_key text NOT NULL,
  title text NOT NULL,
  host_script text NOT NULL,
  trigger_hint text,
  sequence int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS segment_remedies_world_segment_idx
  ON segment_remedies (world_id, segment_key, sequence);

ALTER TABLE segment_remedies ENABLE ROW LEVEL SECURITY;
