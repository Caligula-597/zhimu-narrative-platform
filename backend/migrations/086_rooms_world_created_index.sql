-- migrate:no-transaction
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_world_created
  ON rooms(world_id, created_at DESC);
