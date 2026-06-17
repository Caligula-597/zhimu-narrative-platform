-- Player plaza: platform-wide chat & recruit board (outside any running room).

CREATE TABLE play_plaza_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_display_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('chat', 'recruit')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  invite_code text,
  room_label text,
  world_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_play_plaza_posts_created ON play_plaza_posts (created_at DESC);
CREATE INDEX idx_play_plaza_posts_kind ON play_plaza_posts (kind, created_at DESC);
