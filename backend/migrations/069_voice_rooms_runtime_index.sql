-- migrate:no-transaction
-- Existing deployments can build this without blocking voice-room writes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_rooms_room_status_created
  ON voice_rooms(room_id, status, expires_at, created_at DESC);
