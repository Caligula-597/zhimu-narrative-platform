-- Website closed-beta application queue (Part 6)

CREATE TABLE IF NOT EXISTS beta_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text NOT NULL,
  role_intent text NOT NULL DEFAULT 'creator',
  use_case text NOT NULL,
  referral_source text,
  contact text,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_at timestamptz,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beta_applications_status_check
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT beta_applications_role_intent_check
    CHECK (role_intent IN ('creator', 'host', 'player', 'mixed', 'other'))
);

CREATE INDEX IF NOT EXISTS beta_applications_status_created_idx
  ON beta_applications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS beta_applications_email_lower_idx
  ON beta_applications (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS beta_applications_one_pending_per_email
  ON beta_applications (lower(email))
  WHERE status = 'pending';
