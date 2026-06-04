-- Host audit trail and idempotency for sensitive write paths.

CREATE TABLE IF NOT EXISTS host_audit_log (
  id bigserial PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_host_audit_log_room_created
  ON host_audit_log(room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS write_idempotency (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  route_key text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_write_idempotency_created
  ON write_idempotency(created_at);
