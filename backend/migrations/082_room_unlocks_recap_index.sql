-- migrate:no-transaction
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_content_unlocks_room_type_unlocked
  ON room_content_unlocks(room_id, content_type, unlocked_at, content_id);
