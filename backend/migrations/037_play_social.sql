-- Forum replies, moderation reports, friendships, and private messages for play portal.

ALTER TABLE play_plaza_posts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_count int NOT NULL DEFAULT 0;

CREATE TABLE play_plaza_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES play_plaza_posts(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_display_name text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  parent_reply_id uuid REFERENCES play_plaza_replies(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_play_plaza_replies_post ON play_plaza_replies (post_id, created_at);

CREATE TABLE play_plaza_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'reply')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 4 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_user_id, target_type, target_id)
);

CREATE TABLE play_friendships (
  user_low_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_low_id, user_high_id),
  CHECK (user_low_id <> user_high_id)
);

CREATE INDEX idx_play_friendships_status ON play_friendships (status, updated_at DESC);

CREATE TABLE play_dm_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_low_id, user_high_id),
  CHECK (user_low_id <> user_high_id)
);

CREATE TABLE play_dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES play_dm_conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX idx_play_dm_messages_conv ON play_dm_messages (conversation_id, created_at DESC);
