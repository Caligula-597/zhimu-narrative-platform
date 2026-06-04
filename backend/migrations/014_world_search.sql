-- Accelerate world content search (pg_trgm). Search also works without these indexes via ILIKE.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_role_slots_world_name_trgm ON role_slots USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_scenes_world_name_trgm ON scenes USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clues_world_name_trgm ON clues USING gin (name gin_trgm_ops);

DO $$
BEGIN
  IF to_regclass('public.automation_rules') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_automation_rules_world_name_trgm ON automation_rules USING gin (name gin_trgm_ops);
  END IF;
END $$;
