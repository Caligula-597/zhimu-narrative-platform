-- Versioned room-scoped extension state for cross-client experiences which do
-- not belong in the immutable authored world or the core mechanism engine.
-- New experience kinds must add an application-level validator; they do not
-- require another table migration.
CREATE TABLE room_experience_states (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  state_kind text NOT NULL CHECK (state_kind ~ '^[a-z][a-z0-9_]{1,63}$'),
  scope_key text NOT NULL CHECK (char_length(scope_key) BETWEEN 1 AND 160),
  subject_key text NOT NULL DEFAULT 'room' CHECK (char_length(subject_key) BETWEEN 1 AND 160),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  visibility text NOT NULL DEFAULT 'host' CHECK (visibility IN ('host', 'role', 'room', 'public')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, state_kind, scope_key, subject_key),
  CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX room_experience_states_room_kind_updated_idx
  ON room_experience_states(room_id, state_kind, updated_at DESC);

CREATE INDEX room_experience_states_expiry_idx
  ON room_experience_states(expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE room_experience_states ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE room_experience_states IS
  'Versioned extension state for discovery, pacing, conclusion and future typed room experiences; application services own audience projection.';
COMMENT ON COLUMN room_experience_states.payload IS
  'Kind-specific object validated by the corresponding application contract before persistence.';
COMMENT ON COLUMN room_experience_states.revision IS
  'Optimistic concurrency token; clients must replace only the revision they read.';
