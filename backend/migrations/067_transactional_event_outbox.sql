-- Transactional outbox: critical domain writes and their room events commit atomically.

CREATE TABLE IF NOT EXISTS event_outbox (
  id bigserial PRIMARY KEY,
  event_scope text NOT NULL CHECK (event_scope IN ('room', 'platform_user', 'platform_broadcast')),
  audience_id uuid,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'published', 'dead')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  published_at timestamptz,
  journal_id bigint,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (event_scope IN ('room', 'platform_user') AND audience_id IS NOT NULL)
    OR (event_scope = 'platform_broadcast' AND audience_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_event_outbox_dispatch
  ON event_outbox(available_at, id)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_event_outbox_retention
  ON event_outbox(published_at)
  WHERE status IN ('published', 'dead');

ALTER TABLE event_outbox ENABLE ROW LEVEL SECURITY;
