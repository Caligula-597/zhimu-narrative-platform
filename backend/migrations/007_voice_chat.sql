CREATE TABLE voice_room_messages (
  id bigserial PRIMARY KEY,
  voice_room_id uuid NOT NULL REFERENCES voice_rooms(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_room_messages_created
  ON voice_room_messages(voice_room_id, created_at DESC);
