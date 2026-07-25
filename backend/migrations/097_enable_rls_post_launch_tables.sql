-- Tables added after the original public-schema RLS sweeps must not be
-- directly readable through Supabase/PostgREST.

ALTER TABLE platform_event_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_account_creation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_review_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_releases ENABLE ROW LEVEL SECURITY;
