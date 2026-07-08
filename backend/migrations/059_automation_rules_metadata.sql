-- Rule creator metadata (story purpose binding, notes) without polluting conditions JSON.

ALTER TABLE automation_rules
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
