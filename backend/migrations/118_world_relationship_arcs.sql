-- Relationship Arc: a multi-stage progression between two characters.
-- Each arc has ordered stages, and each stage can define a label, description,
-- trigger condition, and the relationship change it causes.
-- Stages are stored as JSONB (mirrors the timeline cognitions pattern).

CREATE TABLE IF NOT EXISTS world_relationship_arcs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id      UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',                -- short label, e.g. "R-01"
  char_a_id     UUID,                                    -- party A (role slot, nullable)
  char_a_label  TEXT NOT NULL DEFAULT '',                -- persistent display name for A
  char_b_id     UUID,                                    -- party B (role slot, nullable)
  char_b_label  TEXT NOT NULL DEFAULT '',                -- persistent display name for B
  summary       TEXT NOT NULL DEFAULT '',                -- overview of the arc
  stages        JSONB NOT NULL DEFAULT '[]'::jsonb,      -- array of RelationshipStage
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relationship_arcs_world
  ON world_relationship_arcs (world_id);

CREATE INDEX IF NOT EXISTS idx_relationship_arcs_char_a
  ON world_relationship_arcs (char_a_id);

CREATE INDEX IF NOT EXISTS idx_relationship_arcs_char_b
  ON world_relationship_arcs (char_b_id);

COMMENT ON TABLE  world_relationship_arcs IS 'Multi-stage relationship progression between two characters';
COMMENT ON COLUMN world_relationship_arcs.stages IS 'Array of {id, label, description, trigger, change}';