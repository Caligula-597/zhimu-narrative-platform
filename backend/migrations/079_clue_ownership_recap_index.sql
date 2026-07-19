-- migrate:no-transaction
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clue_ownership_room_acquired
  ON clue_ownership(room_id, acquired_at, clue_id);
