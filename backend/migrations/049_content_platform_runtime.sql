-- Content platform runtime primitives (049, after credits/LLM):
-- Segment aggregation, vote/accusation, private action/trade, truth chain,
-- role relationship graph, and playtest analytics artifacts.
-- Player suspicion uses player_suspicions (051), not a separate room table.

CREATE TABLE IF NOT EXISTS world_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  segment_key text NOT NULL,
  title text NOT NULL,
  sequence integer NOT NULL DEFAULT 1 CHECK (sequence > 0),
  chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL,
  story jsonb NOT NULL DEFAULT '{}'::jsonb,
  mechanics jsonb NOT NULL DEFAULT '{}'::jsonb,
  operations jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, segment_key)
);

CREATE INDEX IF NOT EXISTS world_segments_world_sequence_idx
  ON world_segments(world_id, sequence, created_at);

CREATE TABLE IF NOT EXISTS world_segment_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id uuid NOT NULL REFERENCES world_segments(id) ON DELETE CASCADE,
  ref_type text NOT NULL CHECK (ref_type IN ('chapter', 'script_section', 'scene', 'clue', 'item', 'rule', 'truth_claim')),
  ref_id uuid NOT NULL,
  role_slot_id uuid REFERENCES role_slots(id) ON DELETE CASCADE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS world_segment_refs_ref_idx
  ON world_segment_refs(ref_type, ref_id);

CREATE UNIQUE INDEX IF NOT EXISTS world_segment_refs_unique_idx
  ON world_segment_refs(segment_id, ref_type, ref_id, COALESCE(role_slot_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE IF NOT EXISTS world_truth_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  claim_key text,
  title text NOT NULL,
  claim text NOT NULL,
  reveal_stage text,
  confidence text NOT NULL DEFAULT 'canon' CHECK (confidence IN ('canon', 'inferred', 'misdirection', 'unknown')),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  contradictions jsonb NOT NULL DEFAULT '[]'::jsonb,
  role_visibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, claim_key)
);

CREATE INDEX IF NOT EXISTS world_truth_claims_world_idx
  ON world_truth_claims(world_id, created_at);

CREATE TABLE IF NOT EXISTS world_role_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  from_role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  to_role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'relationship',
  label text NOT NULL DEFAULT '',
  strength integer CHECK (strength IS NULL OR (strength >= -10 AND strength <= 10)),
  visibility visibility_scope NOT NULL DEFAULT 'host',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, from_role_slot_id, to_role_slot_id, relation_type)
);

CREATE INDEX IF NOT EXISTS world_role_relationships_world_idx
  ON world_role_relationships(world_id, from_role_slot_id, to_role_slot_id);

CREATE TABLE IF NOT EXISTS room_role_states (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  faction_key text,
  public_alias text,
  hidden_identity text,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, role_slot_id)
);

CREATE TABLE IF NOT EXISTS room_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  segment_id uuid REFERENCES world_segments(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  prompt text NOT NULL DEFAULT '',
  vote_type text NOT NULL DEFAULT 'accusation' CHECK (vote_type IN ('accusation', 'choice', 'rating', 'custom')),
  visibility text NOT NULL DEFAULT 'secret_until_published' CHECK (visibility IN ('secret', 'public', 'secret_until_published')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'closed', 'published', 'cancelled')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS room_votes_room_status_idx
  ON room_votes(room_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS room_vote_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id uuid NOT NULL REFERENCES room_votes(id) ON DELETE CASCADE,
  role_slot_id uuid REFERENCES role_slots(id) ON DELETE SET NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  sequence integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS room_vote_options_vote_idx
  ON room_vote_options(vote_id, sequence);

CREATE TABLE IF NOT EXISTS room_vote_ballots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id uuid NOT NULL REFERENCES room_votes(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  option_id uuid REFERENCES room_vote_options(id) ON DELETE SET NULL,
  free_text text NOT NULL DEFAULT '',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vote_id, role_slot_id)
);

CREATE INDEX IF NOT EXISTS room_vote_ballots_room_idx
  ON room_vote_ballots(room_id, vote_id);

CREATE TABLE IF NOT EXISTS room_private_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  segment_id uuid REFERENCES world_segments(id) ON DELETE SET NULL,
  actor_role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  target_role_slot_id uuid REFERENCES role_slots(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('ask_host', 'secret_action', 'trade', 'promise', 'accusation_note')),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'seen', 'accepted', 'rejected', 'resolved', 'cancelled')),
  host_response text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'actor_host' CHECK (visibility IN ('actor_host', 'actor_target_host', 'host_only', 'postgame')),
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS room_private_actions_room_status_idx
  ON room_private_actions(room_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS room_private_actions_actor_idx
  ON room_private_actions(room_id, actor_role_slot_id, created_at DESC);

CREATE TABLE IF NOT EXISTS world_quality_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'matrix', 'publish_readiness', 'playtest')),
  prompt_version text,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  issue_count integer NOT NULL DEFAULT 0 CHECK (issue_count >= 0),
  score numeric,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS world_quality_reports_world_created_idx
  ON world_quality_reports(world_id, created_at DESC);
