-- migrate:no-transaction
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rule_executions_room_executed
  ON rule_executions(room_id, executed_at, id);
