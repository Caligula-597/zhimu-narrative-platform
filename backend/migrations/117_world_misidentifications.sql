-- Misidentification register: who holds a mistaken belief, when it forms,
-- what evidence overthrows it, and how long it lasts.
-- Supports timeline display by act + timestamp. Bound to clues (line of evidence)
-- and items (physical evidence) via nullable FKs.

CREATE TABLE IF NOT EXISTS world_misidentifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id         UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  act_id           UUID NOT NULL,                            -- act/chapter this misID lives in
  timestamp        TEXT NOT NULL DEFAULT '',                 -- exact ("17:00") or fuzzy ("傍晚") when it forms
  sort_order       INTEGER NOT NULL DEFAULT 0,               -- ordering within the act (timeline position)
  holder_id        UUID,                                     -- FK to role slot / character holding the belief (nullable)
  holder_label     TEXT NOT NULL DEFAULT '',                 -- persistent display name of the holder
  title            TEXT NOT NULL DEFAULT '',                 -- short label, e.g. "K-01"
  content          TEXT NOT NULL DEFAULT '',                 -- the mistaken cognition / belief
  truth            TEXT NOT NULL DEFAULT '',                 -- the actual fact that corrects it (optional)
  refuted_by_clue_id UUID,                                   -- FK to clues that overthrows it (nullable)
  refuted_by_item_id UUID,                                   -- FK to items (physical evidence) that overthrows it (nullable)
  refuted_at       TEXT NOT NULL DEFAULT '',                 -- exact/fuzzy time when it was overturned
  duration         TEXT NOT NULL DEFAULT '',                 -- how long the misID lasts, e.g. "17:40-19:30"
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,            -- still held (timeline marks it live = red) vs refuted (grey/struck)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reference guards: only link clues/items that belong to the same world.
ALTER TABLE world_misidentifications DROP CONSTRAINT IF EXISTS world_misidentifications_clue_world_fk;
ALTER TABLE world_misidentifications ADD CONSTRAINT world_misidentifications_clue_world_fk
  FOREIGN KEY (refuted_by_clue_id) REFERENCES clues(id) ON DELETE SET NULL;
ALTER TABLE world_misidentifications DROP CONSTRAINT IF EXISTS world_misidentifications_item_world_fk;
ALTER TABLE world_misidentifications ADD CONSTRAINT world_misidentifications_item_world_fk
  FOREIGN KEY (refuted_by_item_id) REFERENCES items(id) ON DELETE SET NULL;

-- Quick lookup by world + act (timeline display, act filtering)
CREATE INDEX IF NOT EXISTS idx_misidentifications_world_act
  ON world_misidentifications (world_id, act_id, sort_order);

-- Lookup by holder
CREATE INDEX IF NOT EXISTS idx_misidentifications_holder
  ON world_misidentifications (holder_id);

COMMENT ON TABLE  world_misidentifications IS 'Misidentification register: mistaken beliefs held by characters, bound to evidence';
COMMENT ON COLUMN world_misidentifications.refuted_by_clue_id IS 'Clue that overthrows this misidentification (optional)';
COMMENT ON COLUMN world_misidentifications.refuted_by_item_id IS 'Physical item/evidence that overthrows this misidentification (optional)';
COMMENT ON COLUMN world_misidentifications.is_active IS 'Still held (live) vs already refuted';