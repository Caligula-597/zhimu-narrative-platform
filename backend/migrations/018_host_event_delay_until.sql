ALTER TABLE pending_host_events
  ADD COLUMN IF NOT EXISTS delay_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_pending_host_events_delayed_wake
  ON pending_host_events (delay_until)
  WHERE status = 'delayed' AND delay_until IS NOT NULL;
