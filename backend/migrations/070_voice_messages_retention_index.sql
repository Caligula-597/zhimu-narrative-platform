-- migrate:no-transaction
-- The existing (voice_room_id, created_at) index serves room history reads;
-- retention scans need created_at as the leading column.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_room_messages_retention
  ON voice_room_messages(created_at);
