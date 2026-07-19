-- migrate:no-transaction
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investigation_records_room_investigated
  ON investigation_records(room_id, investigated_at, investigation_point_id, role_slot_id);
