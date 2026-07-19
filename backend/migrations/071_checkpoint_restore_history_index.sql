-- migrate:no-transaction
-- History reads filter by both room and checkpoint, then sort newest-first.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checkpoint_restores_room_checkpoint_created
  ON checkpoint_restores (room_id, checkpoint_id, created_at DESC);
