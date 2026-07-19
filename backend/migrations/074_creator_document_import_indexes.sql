-- migrate:no-transaction
-- Import deduplication and character-script lookup paths.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_script_sections_role_import_key
  ON script_sections(role_slot_id, (metadata->>'importKey'))
  WHERE metadata ? 'importKey';
