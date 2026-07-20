-- migrate:no-transaction
CREATE INDEX CONCURRENTLY IF NOT EXISTS auth_account_creation_events_user_idx
  ON auth_account_creation_events (user_id)
  WHERE user_id IS NOT NULL;
