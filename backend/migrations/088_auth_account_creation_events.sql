CREATE TABLE IF NOT EXISTS auth_account_creation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  account_kind user_kind NOT NULL,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_account_creation_events_ip_hash_check
    CHECK (char_length(ip_hash) BETWEEN 16 AND 128)
);

ALTER TABLE auth_account_creation_events ENABLE ROW LEVEL SECURITY;
