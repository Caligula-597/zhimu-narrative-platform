CREATE TABLE IF NOT EXISTS room_mini_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  game_type text NOT NULL DEFAULT 'zhimu_lock',
  title text NOT NULL DEFAULT 'Mini game',
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  private_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'skipped')),
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  completed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_mini_games_one_active
  ON room_mini_games(room_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_room_mini_games_room_updated
  ON room_mini_games(room_id, updated_at DESC);
