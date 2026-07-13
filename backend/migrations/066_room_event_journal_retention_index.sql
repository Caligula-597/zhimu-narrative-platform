-- migrate:no-transaction
-- Existing room journals may be large; avoid blocking writes during rollout.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_event_journal_created_at
  ON room_event_journal(created_at);
