CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE world_status AS ENUM ('draft', 'testing', 'published', 'archived');
CREATE TYPE member_role AS ENUM ('owner', 'editor', 'host', 'viewer');
CREATE TYPE room_status AS ENUM ('draft', 'testing', 'active', 'paused', 'completed', 'archived');
CREATE TYPE room_member_type AS ENUM ('host', 'cohost', 'player', 'spectator');
CREATE TYPE room_member_status AS ENUM ('invited', 'active', 'left', 'removed');
CREATE TYPE visibility_scope AS ENUM ('author', 'host', 'role', 'faction', 'public', 'postgame');
CREATE TYPE rule_mode AS ENUM ('automatic', 'host_confirm', 'manual');
CREATE TYPE voice_room_type AS ENUM ('public', 'role_private', 'invite_private');
CREATE TYPE token_status AS ENUM ('issued', 'activated', 'revoked');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  display_name text NOT NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE worlds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  summary text NOT NULL DEFAULT '',
  status world_status NOT NULL DEFAULT 'draft',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE world_members (
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role member_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (world_id, user_id)
);

CREATE TABLE chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  sequence integer NOT NULL CHECK (sequence > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, sequence)
);

CREATE TABLE role_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name text NOT NULL,
  public_profile text NOT NULL DEFAULT '',
  private_profile text NOT NULL DEFAULT '',
  faction_key text,
  sequence integer NOT NULL CHECK (sequence > 0),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, sequence)
);

CREATE TABLE character_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE script_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_script_id uuid NOT NULL REFERENCES character_scripts(id) ON DELETE CASCADE,
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (character_script_id, sequence)
);

CREATE TABLE scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL,
  name text NOT NULL,
  public_text text NOT NULL DEFAULT '',
  host_text text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name text NOT NULL,
  public_text text NOT NULL DEFAULT '',
  host_text text NOT NULL DEFAULT '',
  visibility visibility_scope NOT NULL DEFAULT 'role',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name text NOT NULL,
  public_text text NOT NULL DEFAULT '',
  host_text text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE RESTRICT,
  host_user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  invite_code text NOT NULL UNIQUE,
  status room_status NOT NULL DEFAULT 'draft',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE room_members (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_type room_member_type NOT NULL,
  role_slot_id uuid REFERENCES role_slots(id) ON DELETE SET NULL,
  status room_member_status NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id),
  UNIQUE (room_id, role_slot_id)
);

CREATE TABLE player_states (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  current_scene_id uuid REFERENCES scenes(id) ON DELETE SET NULL,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, role_slot_id)
);

CREATE TABLE reading_progress (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  script_section_id uuid NOT NULL REFERENCES script_sections(id) ON DELETE CASCADE,
  started_at timestamptz,
  completed_at timestamptz,
  PRIMARY KEY (room_id, role_slot_id, script_section_id)
);

CREATE TABLE notebook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  source_type text NOT NULL CHECK (source_type IN ('script_section', 'clue', 'manual')),
  source_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clue_ownership (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  clue_id uuid NOT NULL REFERENCES clues(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (room_id, role_slot_id, clue_id)
);

CREATE TABLE inventory (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (room_id, role_slot_id, item_id)
);

CREATE TABLE room_content_unlocks (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('script_section', 'scene', 'clue', 'item', 'event')),
  content_id uuid NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  unlocked_by_rule_id uuid,
  PRIMARY KEY (room_id, content_type, content_id)
);

CREATE TABLE automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  mode rule_mode NOT NULL DEFAULT 'automatic',
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  conditions jsonb NOT NULL,
  actions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rule_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE timeline_logs (
  id bigserial PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  visibility visibility_scope NOT NULL DEFAULT 'host',
  event_type text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  label text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE voice_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  room_type voice_room_type NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  provider_room_key text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE voice_room_members (
  voice_room_id uuid NOT NULL REFERENCES voice_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  joined_at timestamptz,
  PRIMARY KEY (voice_room_id, user_id)
);

CREATE TABLE physical_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  token_code text NOT NULL UNIQUE,
  content_type text NOT NULL CHECK (content_type IN ('clue', 'item', 'script_section', 'event')),
  content_id uuid NOT NULL,
  status token_status NOT NULL DEFAULT 'issued',
  activation_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  activated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  activated_in_room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_script_sections_role_sequence ON script_sections(role_slot_id, sequence);
CREATE INDEX idx_room_members_user ON room_members(user_id, room_id);
CREATE INDEX idx_reading_progress_room ON reading_progress(room_id, role_slot_id);
CREATE INDEX idx_notebook_entries_role ON notebook_entries(room_id, role_slot_id, created_at DESC);
CREATE INDEX idx_clue_ownership_role ON clue_ownership(room_id, role_slot_id);
CREATE INDEX idx_timeline_logs_room_created ON timeline_logs(room_id, created_at DESC);
CREATE INDEX idx_rules_room_enabled ON automation_rules(room_id, enabled, priority);

ALTER TABLE room_content_unlocks
  ADD CONSTRAINT fk_room_content_unlock_rule
  FOREIGN KEY (unlocked_by_rule_id) REFERENCES automation_rules(id) ON DELETE SET NULL;
