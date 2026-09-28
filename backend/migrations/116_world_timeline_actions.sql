-- Timeline Actions: multi-line parallel action timeline for script editing
-- Each entry belongs to one act and one parallel line, with actions and cognitions.
-- Uses JSONB for the cognitions array to allow flexible per-entry structure.

CREATE TABLE IF NOT EXISTS world_timeline_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id      UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  act_id        UUID NOT NULL,
  timestamp     TEXT NOT NULL DEFAULT '',        -- "17:00" or "傍晚" or "第二日清晨"
  sort_order    INTEGER NOT NULL DEFAULT 0,      -- ordering within the act
  parallel_line INTEGER NOT NULL DEFAULT 0,      -- 0, 1, 2, … each line is a parallel track
  actor_id      UUID,                            -- FK to role slot / character (nullable for environmental events)
  action        TEXT NOT NULL DEFAULT '',         -- what the character does
  impact        TEXT NOT NULL DEFAULT '',         -- what impact this action has on the world
  cognitions    JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of CognitionItem
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by world + act
CREATE INDEX IF NOT EXISTS idx_timeline_entries_world_act
  ON world_timeline_entries (world_id, act_id, sort_order);

-- Index for parallel line queries
CREATE INDEX IF NOT EXISTS idx_timeline_entries_parallel
  ON world_timeline_entries (world_id, parallel_line, sort_order);

COMMENT ON TABLE  world_timeline_entries IS 'Multi-line parallel action timeline entries for script editing';
COMMENT ON COLUMN world_timeline_entries.timestamp IS 'Exact ("17:00") or fuzzy ("傍晚") time marker';
COMMENT ON COLUMN world_timeline_entries.parallel_line IS '0-based parallel track index';
COMMENT ON COLUMN world_timeline_entries.action IS 'What the character does';
COMMENT ON COLUMN world_timeline_entries.impact IS 'What impact this action has on the world';
COMMENT ON COLUMN world_timeline_entries.cognitions IS 'Array of {id, characterId, content, isMisleading}';