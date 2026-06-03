ALTER TABLE clue_ownership
  ADD COLUMN IF NOT EXISTS shared_with_room boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_with_roles uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS player_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS host_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shared_at timestamptz;

CREATE TABLE IF NOT EXISTS clue_read_receipts (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  clue_id uuid NOT NULL REFERENCES clues(id) ON DELETE CASCADE,
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, clue_id, role_slot_id)
);

CREATE INDEX IF NOT EXISTS idx_clue_ownership_shared ON clue_ownership(room_id, shared_with_room)
  WHERE shared_with_room = true;
