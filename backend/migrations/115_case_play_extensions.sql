-- Case play extensions: per-role material booklet grants + investigation use counts.

CREATE TABLE IF NOT EXISTS room_material_booklet_grants (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  booklet_id uuid NOT NULL REFERENCES world_material_booklets(id) ON DELETE CASCADE,
  granted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  message text NOT NULL DEFAULT '',
  PRIMARY KEY (room_id, role_slot_id, booklet_id)
);

CREATE INDEX IF NOT EXISTS room_material_booklet_grants_room_role_idx
  ON room_material_booklet_grants (room_id, role_slot_id, granted_at DESC);

COMMENT ON TABLE room_material_booklet_grants IS
  'Host-granted parallel material booklets visible to a player role in a room.';

ALTER TABLE room_mechanism_states
  ADD COLUMN IF NOT EXISTS investigation_use_counts jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE room_mechanism_states
  DROP CONSTRAINT IF EXISTS room_mechanism_states_investigation_use_counts_object;

ALTER TABLE room_mechanism_states
  ADD CONSTRAINT room_mechanism_states_investigation_use_counts_object
  CHECK (jsonb_typeof(investigation_use_counts) = 'object');

COMMENT ON COLUMN room_mechanism_states.investigation_use_counts IS
  'Per investigation-action use counters for cost/maxUses enforcement across reloads.';
