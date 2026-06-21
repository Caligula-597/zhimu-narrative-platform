CREATE TABLE IF NOT EXISTS account_delete_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'db_deleted', 'storage_pending', 'completed', 'failed')),
  object_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  storage_purged_count int NOT NULL DEFAULT 0,
  last_error text,
  attempt_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS account_delete_jobs_one_active_per_user
  ON account_delete_jobs (user_id)
  WHERE status IN ('pending', 'db_deleted', 'storage_pending');

CREATE INDEX IF NOT EXISTS account_delete_jobs_status_updated_idx
  ON account_delete_jobs (status, updated_at ASC);
