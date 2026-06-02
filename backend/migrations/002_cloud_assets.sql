CREATE TYPE asset_status AS ENUM ('pending_upload', 'active', 'quarantined', 'deleted');
CREATE TYPE upload_status AS ENUM ('created', 'uploaded', 'confirmed', 'expired', 'cancelled');

CREATE TABLE storage_quotas (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  max_bytes bigint NOT NULL DEFAULT 524288000 CHECK (max_bytes >= 0),
  max_worlds integer NOT NULL DEFAULT 2 CHECK (max_worlds >= 0),
  max_single_file_bytes bigint NOT NULL DEFAULT 31457280 CHECK (max_single_file_bytes > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE asset_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
  asset_kind text NOT NULL CHECK (asset_kind IN ('image', 'audio', 'video', 'document', 'archive')),
  visibility visibility_scope NOT NULL DEFAULT 'author',
  role_slot_id uuid REFERENCES role_slots(id) ON DELETE SET NULL,
  object_key text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  content_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  sha256 text,
  storage_provider text NOT NULL DEFAULT 'r2',
  status asset_status NOT NULL DEFAULT 'pending_upload',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_file_id uuid NOT NULL REFERENCES asset_files(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key text NOT NULL,
  expected_content_type text NOT NULL,
  expected_byte_size bigint NOT NULL CHECK (expected_byte_size > 0),
  status upload_status NOT NULL DEFAULT 'created',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

CREATE TABLE asset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_file_id uuid NOT NULL REFERENCES asset_files(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  object_key text NOT NULL UNIQUE,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  sha256 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_file_id, version_number)
);

CREATE TABLE deleted_assets (
  asset_file_id uuid PRIMARY KEY REFERENCES asset_files(id) ON DELETE CASCADE,
  deleted_by_user_id uuid NOT NULL REFERENCES users(id),
  reason text NOT NULL DEFAULT '',
  purge_after timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_files_owner_status ON asset_files(owner_user_id, status);
CREATE INDEX idx_asset_files_world_status ON asset_files(world_id, status);
CREATE INDEX idx_upload_sessions_expiry ON upload_sessions(status, expires_at);
CREATE INDEX idx_deleted_assets_purge_after ON deleted_assets(purge_after);

INSERT INTO storage_quotas (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;
