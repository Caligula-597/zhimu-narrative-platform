-- Per-act / per-day appearance & identity state for body-swap / multi-form scripts.

ALTER TABLE world_role_archives
  ADD COLUMN IF NOT EXISTS appearance_states jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN world_role_archives.appearance_states IS
  'Ordered appearance/state rows: [{phaseLabel, appearance, notes}]. True identity stays in hidden_identity.';
