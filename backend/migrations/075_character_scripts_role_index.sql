-- migrate:no-transaction
-- Character-script lookup by role during serialized document imports.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_character_scripts_role_created
  ON character_scripts(role_slot_id, created_at);
