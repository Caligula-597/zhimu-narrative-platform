-- B2: Per-player suspicion levels toward other roles

CREATE TABLE IF NOT EXISTS player_suspicions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  observer_role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  target_role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  level int NOT NULL DEFAULT 0,
  reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_suspicions_level_check CHECK (level BETWEEN 0 AND 5),
  CONSTRAINT player_suspicions_distinct_target CHECK (observer_role_slot_id <> target_role_slot_id),
  UNIQUE (room_id, observer_role_slot_id, target_role_slot_id)
);

CREATE INDEX IF NOT EXISTS player_suspicions_room_observer_idx
  ON player_suspicions (room_id, observer_role_slot_id);

ALTER TABLE player_suspicions ENABLE ROW LEVEL SECURITY;
