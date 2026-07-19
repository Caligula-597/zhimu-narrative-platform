-- migrate:no-transaction
-- Item deletion/reference checks filter by world and required item.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investigation_points_world_required_item
  ON investigation_points(world_id, required_item_id)
  WHERE required_item_id IS NOT NULL;
