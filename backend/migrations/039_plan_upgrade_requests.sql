CREATE TABLE IF NOT EXISTS plan_upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  current_plan_code text NOT NULL,
  desired_plan_code text NOT NULL,
  reason text NOT NULL DEFAULT '',
  contact text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS plan_upgrade_requests_one_pending_per_user
  ON plan_upgrade_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS plan_upgrade_requests_status_created_idx
  ON plan_upgrade_requests (status, created_at DESC);
