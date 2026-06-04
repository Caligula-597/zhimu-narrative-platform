-- Runtime foundation: checkpoint restore audit, durable event journal, query indexes.

ALTER TABLE checkpoints
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 2;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checkpoint_restore_status') THEN
    CREATE TYPE checkpoint_restore_status AS ENUM ('pending', 'applied', 'failed', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS checkpoint_restores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  checkpoint_id uuid NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES users(id),
  status checkpoint_restore_status NOT NULL DEFAULT 'pending',
  restore_scope jsonb NOT NULL DEFAULT '{
    "readingProgress": true,
    "clueOwnership": true,
    "inventory": true,
    "contentUnlocks": true,
    "pendingHostEvents": true,
    "ruleExecutions": false
  }'::jsonb,
  before_snapshot jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkpoint_restores_room_created
  ON checkpoint_restores(room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkpoint_restores_checkpoint
  ON checkpoint_restores(checkpoint_id, created_at DESC);

CREATE TABLE IF NOT EXISTS room_event_journal (
  id bigserial PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_event_journal_room_id
  ON room_event_journal(room_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_room_role
  ON inventory(room_id, role_slot_id);

CREATE INDEX IF NOT EXISTS idx_items_world_id
  ON items(world_id);

CREATE INDEX IF NOT EXISTS idx_clues_world_id
  ON clues(world_id);

CREATE INDEX IF NOT EXISTS idx_scenes_world_id
  ON scenes(world_id);

CREATE INDEX IF NOT EXISTS idx_checkpoints_room_created
  ON checkpoints(room_id, created_at DESC);
