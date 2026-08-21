-- P2-04: stable protocol metadata for all current and future mini-game adapters.
ALTER TABLE room_mini_games
  ADD COLUMN IF NOT EXISTS protocol_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS settlement jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE room_mini_games
  DROP CONSTRAINT IF EXISTS room_mini_games_status_check;

ALTER TABLE room_mini_games
  ADD CONSTRAINT room_mini_games_status_check
  CHECK (status IN ('active', 'completed', 'failed', 'timed_out', 'skipped'));

CREATE INDEX IF NOT EXISTS room_mini_games_active_deadline_idx
  ON room_mini_games(deadline_at)
  WHERE status = 'active' AND deadline_at IS NOT NULL;
