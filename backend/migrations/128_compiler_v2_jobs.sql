-- Compiler V2 staging / draft workspace (NOT runtime truth).
-- Lifecycle: upload → compiler_v2_* → User Review → COMMIT → formal World/Runtime tables.

CREATE TABLE IF NOT EXISTS compiler_v2_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id        UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN (
                    'queued', 'processing', 'needs_review', 'failed', 'completed', 'committed'
                  )),
  current_stage   TEXT NOT NULL DEFAULT 'queued',
  -- Full CompilerV2State JSON — authoritative during compile / review.
  state           JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code      TEXT,
  error_message   TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compiler_v2_jobs_world
  ON compiler_v2_jobs (world_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compiler_v2_jobs_status
  ON compiler_v2_jobs (world_id, status);

COMMENT ON TABLE compiler_v2_jobs IS
  'Compiler V2 import job + staging state snapshot. Draft only; commit writes formal runtime models.';
COMMENT ON COLUMN compiler_v2_jobs.state IS
  'CompilerV2State JSON (project/documents/scripts/timeline/scenes/clues/mechanisms/warnings/unresolved).';
