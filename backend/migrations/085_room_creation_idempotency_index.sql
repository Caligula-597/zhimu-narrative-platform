-- migrate:no-transaction
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_creation_idempotency
  ON rooms(world_id, host_user_id, creation_idempotency_key)
  WHERE creation_idempotency_key IS NOT NULL;
