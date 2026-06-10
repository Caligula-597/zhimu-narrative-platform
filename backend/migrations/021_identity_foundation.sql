-- Identity foundation: guest accounts, session devices, plans, collaborator invites.

CREATE TYPE user_kind AS ENUM ('registered', 'guest');

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_kind user_kind NOT NULL DEFAULT 'registered';

UPDATE users SET user_kind = 'registered' WHERE user_kind IS NULL;

ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS device_label text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS auth_sessions_user_active_idx
  ON auth_sessions (user_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS user_plans (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_code text NOT NULL DEFAULT 'free' CHECK (plan_code IN ('free', 'creator', 'studio')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO user_plans (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS world_member_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  email text NOT NULL,
  role member_role NOT NULL CHECK (role <> 'owner'),
  token_hash text NOT NULL UNIQUE,
  invited_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, email)
);

CREATE INDEX IF NOT EXISTS world_member_invites_email_idx
  ON world_member_invites (lower(email))
  WHERE accepted_at IS NULL;
