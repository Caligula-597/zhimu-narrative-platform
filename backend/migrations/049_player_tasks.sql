-- B1: Player tasks (Matrix actTasks → runtime task list)

CREATE TABLE IF NOT EXISTS player_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  act_key text NOT NULL,
  body text NOT NULL,
  tips text,
  visibility text NOT NULL DEFAULT 'public',
  sequence int NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_tasks_visibility_check
    CHECK (visibility IN ('public', 'secret', 'optional'))
);

CREATE INDEX IF NOT EXISTS player_tasks_world_role_act_idx
  ON player_tasks (world_id, role_slot_id, act_key, sequence);

CREATE TABLE IF NOT EXISTS player_task_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_task_id uuid NOT NULL REFERENCES player_tasks(id) ON DELETE CASCADE,
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  CONSTRAINT player_task_progress_status_check
    CHECK (status IN ('pending', 'completed')),
  UNIQUE (room_id, player_task_id, role_slot_id)
);

CREATE INDEX IF NOT EXISTS player_task_progress_room_role_idx
  ON player_task_progress (room_id, role_slot_id);

ALTER TABLE player_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_task_progress ENABLE ROW LEVEL SECURITY;
