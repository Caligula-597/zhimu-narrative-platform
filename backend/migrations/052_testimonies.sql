-- B3: Player testimony submissions + host contradiction flags

CREATE TABLE IF NOT EXISTS testimonies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  act_key text,
  body text NOT NULL,
  host_flag text,
  host_note text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT testimonies_host_flag_check
    CHECK (host_flag IS NULL OR host_flag IN ('noted', 'contradiction'))
);

CREATE INDEX IF NOT EXISTS testimonies_room_submitted_idx
  ON testimonies (room_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS testimonies_room_role_idx
  ON testimonies (room_id, role_slot_id);

ALTER TABLE testimonies ENABLE ROW LEVEL SECURITY;
