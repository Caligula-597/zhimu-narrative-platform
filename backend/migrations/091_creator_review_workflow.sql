-- Collaborative editorial review for private creator content.
-- Server routes use direct Postgres connections; no Data API grants are added.

ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'reviewer';

CREATE TABLE creator_review_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  parent_id uuid,
  target_type text NOT NULL CHECK (target_type IN (
    'world', 'manuscript', 'role', 'chapter', 'script_section',
    'scene', 'clue', 'rule', 'truth_claim', 'segment'
  )),
  target_id uuid,
  target_label text NOT NULL DEFAULT '',
  anchor jsonb NOT NULL DEFAULT '{}'::jsonb,
  kind text NOT NULL DEFAULT 'comment' CHECK (kind IN ('comment', 'suggestion', 'change_request')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  severity text NOT NULL DEFAULT 'note' CHECK (severity IN ('note', 'minor', 'major', 'blocking')),
  title text NOT NULL DEFAULT '',
  body text NOT NULL,
  suggested_patch jsonb NOT NULL DEFAULT '{}'::jsonb,
  impact_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (world_id, id),
  FOREIGN KEY (world_id, parent_id)
    REFERENCES creator_review_threads(world_id, id) ON DELETE CASCADE,
  CHECK (
    (target_type IN ('world', 'manuscript') AND target_id IS NULL)
    OR (target_type NOT IN ('world', 'manuscript') AND target_id IS NOT NULL)
  ),
  CHECK (jsonb_typeof(anchor) = 'object'),
  CHECK (jsonb_typeof(suggested_patch) = 'object'),
  CHECK (jsonb_typeof(impact_scope) = 'object')
);

CREATE INDEX creator_review_threads_world_status_updated_idx
  ON creator_review_threads(world_id, status, updated_at DESC);

CREATE INDEX creator_review_threads_target_idx
  ON creator_review_threads(world_id, target_type, target_id, status, updated_at DESC);

CREATE INDEX creator_review_threads_parent_idx
  ON creator_review_threads(parent_id, created_at)
  WHERE parent_id IS NOT NULL;

CREATE INDEX creator_review_threads_created_by_idx
  ON creator_review_threads(created_by_user_id, created_at DESC);

CREATE INDEX creator_review_threads_resolved_by_idx
  ON creator_review_threads(resolved_by_user_id)
  WHERE resolved_by_user_id IS NOT NULL;

ALTER TABLE creator_review_threads ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE creator_review_threads IS
  'Private creator review comments and suggestions; access is enforced by server world membership checks.';
