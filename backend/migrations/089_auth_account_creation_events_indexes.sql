-- migrate:no-transaction
CREATE INDEX CONCURRENTLY IF NOT EXISTS auth_account_creation_events_ip_kind_created_idx
  ON auth_account_creation_events (ip_hash, account_kind, created_at DESC);
