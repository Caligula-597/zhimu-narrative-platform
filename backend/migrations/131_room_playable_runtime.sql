-- P7.1: Playable Content Runtime state bound to existing rooms.
-- Pins immutable PlayableProject snapshot at session start.
CREATE TABLE room_playable_runtime_states (
  room_id uuid PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  playable_project_id text NOT NULL,
  playable_project_revision bigint NOT NULL DEFAULT 0,
  playable_fingerprint text NOT NULL DEFAULT '',
  playable_snapshot jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('NOT_STARTED', 'RUNNING', 'FINISHED')),
  current_stage_id text,
  state jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(playable_snapshot) = 'object'),
  CHECK (jsonb_typeof(state) = 'object')
);

CREATE INDEX room_playable_runtime_states_status_idx
  ON room_playable_runtime_states (status);

COMMENT ON TABLE room_playable_runtime_states IS
  'P7.1 Content Runtime: mutable stage/release/read state + frozen PlayableProject snapshot per room.';
COMMENT ON COLUMN room_playable_runtime_states.playable_snapshot IS
  'Immutable copy of PlayableProject at session bind/start; later world recompiles must not mutate this.';
