-- migrate:no-transaction
-- Creator rule lists and world snapshots filter by world and sort by priority.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_rules_world_priority_created
  ON automation_rules(world_id, priority, created_at);
