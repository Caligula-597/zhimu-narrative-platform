-- Persist story-graph canvas coordinates on public chapters (same pattern as scenes/clues).

ALTER TABLE chapters
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
