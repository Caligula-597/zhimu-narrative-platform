-- Immutable authored-runtime releases. This is intentionally separate from
-- content_versions: creator snapshots remain restorable/deletable working
-- copies, while releases are append-only application records.

CREATE TABLE world_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  release_number integer NOT NULL CHECK (release_number > 0),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  source_content_revision bigint NOT NULL CHECK (source_content_revision > 0),
  snapshot_schema_version integer NOT NULL CHECK (snapshot_schema_version > 0),
  narrative_profile jsonb NOT NULL,
  readiness jsonb NOT NULL,
  content_summary jsonb NOT NULL,
  snapshot jsonb NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  snapshot_bytes integer NOT NULL CHECK (snapshot_bytes > 0),
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  idempotency_key text,
  request_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, release_number),
  UNIQUE (world_id, id),
  CHECK (jsonb_typeof(narrative_profile) = 'object'),
  CHECK (jsonb_typeof(readiness) = 'object'),
  CHECK (jsonb_typeof(content_summary) = 'object'),
  CHECK (jsonb_typeof(snapshot) = 'object'),
  CHECK (idempotency_key IS NULL OR char_length(idempotency_key) BETWEEN 1 AND 128),
  CHECK (
    (idempotency_key IS NULL AND request_hash IS NULL)
    OR (
      idempotency_key IS NOT NULL
      AND request_hash IS NOT NULL
      AND request_hash ~ '^[0-9a-f]{64}$'
    )
  )
);

CREATE UNIQUE INDEX world_releases_idempotency_idx
  ON world_releases(world_id, created_by_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX world_releases_world_created_idx
  ON world_releases(world_id, created_at DESC);

CREATE INDEX world_releases_creator_idx
  ON world_releases(created_by_user_id, created_at DESC)
  WHERE created_by_user_id IS NOT NULL;

ALTER TABLE world_releases ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION reject_world_release_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Account deletion may legitimately anonymize the creator through the FK.
  -- No authored payload or release metadata may change with it.
  IF OLD.created_by_user_id IS NOT NULL
     AND NEW.created_by_user_id IS NULL
     AND (to_jsonb(NEW) - 'created_by_user_id') = (to_jsonb(OLD) - 'created_by_user_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'world_releases are immutable; create a new release instead'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER world_releases_reject_update
  BEFORE UPDATE ON world_releases
  FOR EACH ROW EXECUTE FUNCTION reject_world_release_update();

COMMENT ON TABLE world_releases IS
  'Immutable application releases of authored runtime content. Rows are append-only; world deletion may cascade them.';
COMMENT ON COLUMN world_releases.snapshot IS
  'Server-only release payload. List/create APIs expose metadata and checksum, never the full snapshot.';
COMMENT ON COLUMN world_releases.source_content_revision IS
  'World optimistic content revision captured under the same transaction lock as the release snapshot.';
