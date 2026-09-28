-- Ending Branch Editor: multiple possible endings.
-- Each ending defines a trigger condition, a result text, and additional
-- reveals (attached clues / physical items) unlocked when reached.

CREATE TABLE IF NOT EXISTS world_endings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id        UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT '',               -- short label, e.g. "X-01"
  trigger         TEXT NOT NULL DEFAULT '',               -- condition that leads to this ending
  result          TEXT NOT NULL DEFAULT '',               -- ending result text
  reveal_text     TEXT NOT NULL DEFAULT '',               -- additional information revealed
  reveal_clue_ids JSONB NOT NULL DEFAULT '[]'::jsonb,     -- attached clues unlocked
  reveal_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,     -- attached physical items unlocked
  is_good         BOOLEAN NOT NULL DEFAULT TRUE,          -- good vs bad ending flag
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_world_endings_world
  ON world_endings (world_id, sort_order);

COMMENT ON TABLE  world_endings IS 'Ending branch definitions with trigger, result and reveal attachments';
COMMENT ON COLUMN world_endings.reveal_clue_ids IS 'Clue ids revealed when this ending is reached';