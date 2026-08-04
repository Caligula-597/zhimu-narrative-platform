CREATE TABLE IF NOT EXISTS ops_user_audit_log (
  id bigserial PRIMARY KEY,
  action text NOT NULL,
  target_user_id uuid,
  target_email text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_user_audit_log_created_idx
  ON ops_user_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS ops_user_audit_log_target_email_idx
  ON ops_user_audit_log (lower(target_email), created_at DESC);

ALTER TABLE ops_user_audit_log ENABLE ROW LEVEL SECURITY;
