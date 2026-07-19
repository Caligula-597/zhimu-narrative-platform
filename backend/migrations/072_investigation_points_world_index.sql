-- migrate:no-transaction
-- Studio snapshots and readiness checks filter investigation points by world.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investigation_points_world_scene_sequence
  ON investigation_points(world_id, scene_id, sequence, created_at);
