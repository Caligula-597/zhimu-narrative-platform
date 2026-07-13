-- Durable platform events for plaza, friendship and direct-message SSE replay.

CREATE TABLE IF NOT EXISTS platform_event_journal (
  id bigserial PRIMARY KEY,
  audience_type text NOT NULL CHECK (audience_type IN ('broadcast', 'user')),
  audience_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (audience_type = 'broadcast' AND audience_user_id IS NULL)
    OR (audience_type = 'user' AND audience_user_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_event_journal_broadcast
  ON platform_event_journal(id) WHERE audience_type = 'broadcast';

CREATE INDEX IF NOT EXISTS idx_platform_event_journal_user
  ON platform_event_journal(audience_user_id, id) WHERE audience_type = 'user';

CREATE INDEX IF NOT EXISTS idx_platform_event_journal_created_at
  ON platform_event_journal(created_at);

CREATE INDEX IF NOT EXISTS idx_room_event_journal_created_at
  ON room_event_journal(created_at);

ALTER TABLE platform_event_journal ENABLE ROW LEVEL SECURITY;
