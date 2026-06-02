CREATE TABLE IF NOT EXISTS investigation_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  scene_id uuid NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  interaction_text text NOT NULL DEFAULT '',
  result_text text NOT NULL DEFAULT '',
  clue_id uuid REFERENCES clues(id) ON DELETE SET NULL,
  required_item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  required_role_slot_id uuid REFERENCES role_slots(id) ON DELETE SET NULL,
  sequence integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investigation_points_scene_idx
  ON investigation_points(scene_id, sequence, created_at);

CREATE TABLE IF NOT EXISTS investigation_records (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  investigation_point_id uuid NOT NULL REFERENCES investigation_points(id) ON DELETE CASCADE,
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  investigated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, investigation_point_id, role_slot_id)
);

CREATE TABLE IF NOT EXISTS pending_host_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES automation_rules(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'executed', 'dismissed', 'delayed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_host_events_room_rule_idx
  ON pending_host_events(room_id, rule_id)
  WHERE rule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pending_host_events_room_status_idx
  ON pending_host_events(room_id, status, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS rule_executions_rule_room_idx
  ON rule_executions(rule_id, room_id);
