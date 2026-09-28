-- Host Manual Compiler (缺口6): a manually editable, versioned 主持手册
-- compiled deterministically from every preceding locked内容 module.
--
-- A "version" is produced by a one-click compile (compiled_by = 'system',
-- sections locked). Creators can then edit each section body in editor mode.
-- Re-compiling creates a new version (compiled_by = 'system'); edited sections
-- live on the version they were saved to via world_host_manual_sections.

CREATE TABLE IF NOT EXISTS world_host_manual_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id          UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL DEFAULT 1,
  title             TEXT NOT NULL DEFAULT '主持手册',
  source_fingerprint TEXT NOT NULL DEFAULT '',   -- sha1 of the aggregated source data (staleness detect)
  compiled_by       TEXT NOT NULL DEFAULT 'system', -- 'system' | 'manual'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (world_id, version)
);

CREATE TABLE IF NOT EXISTS world_host_manual_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id     UUID NOT NULL REFERENCES world_host_manual_versions(id) ON DELETE CASCADE,
  world_id      UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  section_key   TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  locked        BOOLEAN NOT NULL DEFAULT TRUE,  -- derived (system) vs creator-edited/custom
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (manual_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_host_manual_versions_world
  ON world_host_manual_versions (world_id, version);

CREATE INDEX IF NOT EXISTS idx_host_manual_sections_manual
  ON world_host_manual_sections (manual_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_host_manual_sections_world
  ON world_host_manual_sections (world_id);

COMMENT ON TABLE  world_host_manual_versions IS 'Versioned, compiled 主持手册 per world';
COMMENT ON COLUMN world_host_manual_versions.source_fingerprint IS 'Deterministic hash of the aggregated source data used to compile this version';
COMMENT ON TABLE  world_host_manual_sections IS 'Sections (chapters) of a host manual version';
COMMENT ON COLUMN world_host_manual_sections.locked IS 'True when derived by a system compile; false once creator-edited or custom';