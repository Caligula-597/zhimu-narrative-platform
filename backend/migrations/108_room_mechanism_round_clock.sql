-- Server-owned start time for the current mechanism round. Timed decisions
-- derive their deadline from this value instead of trusting a player clock.
ALTER TABLE room_mechanism_states
  ADD COLUMN round_started_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN room_mechanism_states.round_started_at IS
  'Authoritative start time of the current mechanism round; reset only when the host advances or reinitializes the runtime.';
