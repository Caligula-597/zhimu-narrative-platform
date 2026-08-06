-- Canonical authored mechanism package. Runtime releases freeze this package;
-- room state must stay in room/runtime tables and never mutate this row.
CREATE TABLE world_mechanism_packages (
  world_id uuid PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  source text NOT NULL CHECK (char_length(source) BETWEEN 1 AND 80),
  package jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(package) = 'object'),
  CHECK (jsonb_typeof(metadata) = 'object'),
  CHECK (
    package ? 'schemaVersion'
    AND jsonb_typeof(package->'schemaVersion') = 'number'
    AND (package->>'schemaVersion')::integer = schema_version
  )
);

ALTER TABLE world_mechanism_packages ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE world_mechanism_packages IS
  'Single canonical authored mechanism package per world. Mutable while authoring; copied into immutable world releases.';
COMMENT ON COLUMN world_mechanism_packages.package IS
  'Versioned fact/state/resource/round/action/evidence/decision/ending contract shared by Creator, Host and runtime.';
