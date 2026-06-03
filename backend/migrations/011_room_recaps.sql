CREATE TABLE IF NOT EXISTS room_recaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  label text NOT NULL DEFAULT '房间复盘',
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_recaps_room_created ON room_recaps(room_id, created_at DESC);
