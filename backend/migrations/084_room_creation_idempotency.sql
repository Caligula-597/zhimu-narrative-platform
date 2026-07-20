ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS creation_idempotency_key text,
  ADD COLUMN IF NOT EXISTS creation_request_hash text;

COMMENT ON COLUMN rooms.creation_idempotency_key IS
  'Client Idempotency-Key used to create this room; scoped by world and creator.';

COMMENT ON COLUMN rooms.creation_request_hash IS
  'Hash of the normalized create-room command, used to reject key reuse with another payload.';
