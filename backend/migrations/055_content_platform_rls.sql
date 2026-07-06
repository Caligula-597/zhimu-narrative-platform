-- Align 047 content-platform tables with B-batch RLS style.
-- Drop deprecated room_suspicion_marks (superseded by player_suspicions / 050).

DROP TABLE IF EXISTS room_suspicion_marks;

ALTER TABLE world_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_segment_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_truth_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_role_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_role_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_vote_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_vote_ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_private_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_quality_reports ENABLE ROW LEVEL SECURITY;
