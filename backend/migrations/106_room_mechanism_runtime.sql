-- Mutable room execution state derived from an immutable authored mechanism
-- package. Never write runtime values back into world_mechanism_packages.
CREATE TABLE room_mechanism_states (
  room_id uuid PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  mechanism_schema_version integer NOT NULL CHECK (mechanism_schema_version > 0),
  content_binding_mode text NOT NULL CHECK (content_binding_mode IN ('live_draft', 'release')),
  content_release_id uuid REFERENCES world_releases(id) ON DELETE RESTRICT,
  source_content_revision bigint NOT NULL CHECK (source_content_revision > 0),
  mechanism_package_sha256 text NOT NULL CHECK (mechanism_package_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('running', 'completed')),
  current_round_key text,
  current_round_sequence integer CHECK (current_round_sequence IS NULL OR current_round_sequence > 0),
  prepared_round_key text,
  current_branch text,
  current_variant_key text,
  state_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  resource_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_states jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_states jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision_states jsonb NOT NULL DEFAULT '{}'::jsonb,
  executed_investigations jsonb NOT NULL DEFAULT '{}'::jsonb,
  ending jsonb,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  initialized_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  initialized_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (
    (content_binding_mode = 'release' AND content_release_id IS NOT NULL)
    OR (content_binding_mode = 'live_draft' AND content_release_id IS NULL)
  ),
  CHECK (jsonb_typeof(state_values) = 'object'),
  CHECK (jsonb_typeof(resource_values) = 'object'),
  CHECK (jsonb_typeof(evidence_states) = 'object'),
  CHECK (jsonb_typeof(event_states) = 'object'),
  CHECK (jsonb_typeof(decision_states) = 'object'),
  CHECK (jsonb_typeof(executed_investigations) = 'object'),
  CHECK (ending IS NULL OR jsonb_typeof(ending) = 'object'),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX room_mechanism_states_binding_idx
  ON room_mechanism_states(content_release_id, source_content_revision);

CREATE TABLE room_mechanism_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  revision_before bigint NOT NULL CHECK (revision_before >= 0),
  revision_after bigint NOT NULL CHECK (revision_after > revision_before),
  round_key text,
  action_type text NOT NULL CHECK (action_type IN ('initialize', 'reset', 'decision', 'investigation', 'advance', 'override')),
  action_key text,
  option_key text,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  request jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, revision_after),
  CHECK (jsonb_typeof(changes) = 'array'),
  CHECK (jsonb_typeof(request) = 'object'),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX room_mechanism_action_log_room_created_idx
  ON room_mechanism_action_log(room_id, created_at DESC);

ALTER TABLE room_mechanism_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_mechanism_action_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE room_mechanism_states IS
  'Mutable per-room mechanism execution state bound to one live revision or immutable release.';
COMMENT ON TABLE room_mechanism_action_log IS
  'Append-only revision ledger for host decisions, investigations, advances and explicit overrides.';
