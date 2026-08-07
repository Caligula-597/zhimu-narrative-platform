-- Per-role submissions for an unresolved authored mechanism decision. The
-- interaction contract decides whether they are advisory or private; the host
-- remains the authoritative runtime executor in both cases.
CREATE TABLE room_mechanism_decision_submissions (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  runtime_initialized_at timestamptz NOT NULL,
  mechanism_revision integer NOT NULL CHECK (mechanism_revision > 0),
  round_key text NOT NULL CHECK (length(round_key) BETWEEN 1 AND 160),
  decision_key text NOT NULL CHECK (length(decision_key) BETWEEN 1 AND 160),
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  option_key text NOT NULL CHECK (length(option_key) BETWEEN 1 AND 160),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, runtime_initialized_at, decision_key, role_slot_id)
);

CREATE INDEX room_mechanism_submissions_current_idx
  ON room_mechanism_decision_submissions(room_id, runtime_initialized_at, decision_key, updated_at DESC);

CREATE INDEX room_mechanism_submissions_role_slot_idx
  ON room_mechanism_decision_submissions(role_slot_id);

CREATE INDEX room_mechanism_submissions_actor_idx
  ON room_mechanism_decision_submissions(actor_user_id)
  WHERE actor_user_id IS NOT NULL;

ALTER TABLE room_mechanism_decision_submissions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE room_mechanism_decision_submissions IS
  'Per-role advisory or private choices for the current room mechanism instance; hosts still perform the authoritative transition.';
