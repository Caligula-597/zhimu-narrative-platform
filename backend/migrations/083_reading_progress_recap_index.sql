-- migrate:no-transaction
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reading_progress_room_completed
  ON reading_progress(room_id, completed_at, role_slot_id, script_section_id)
  WHERE completed_at IS NOT NULL;
