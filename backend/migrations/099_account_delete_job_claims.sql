-- Storage deletion is external I/O. Claim work in a short SKIP LOCKED
-- transaction, then release the database connection before calling storage.

ALTER TABLE account_delete_jobs
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

ALTER TABLE account_delete_jobs
  DROP CONSTRAINT IF EXISTS account_delete_jobs_status_check;

ALTER TABLE account_delete_jobs
  ADD CONSTRAINT account_delete_jobs_status_check
  CHECK (status IN (
    'pending',
    'db_deleted',
    'storage_pending',
    'storage_processing',
    'completed',
    'failed'
  ));

DROP INDEX IF EXISTS account_delete_jobs_one_active_per_user;
CREATE UNIQUE INDEX account_delete_jobs_one_active_per_user
  ON account_delete_jobs (user_id)
  WHERE status IN ('pending', 'db_deleted', 'storage_pending', 'storage_processing');

CREATE INDEX IF NOT EXISTS account_delete_jobs_claim_recovery_idx
  ON account_delete_jobs (claimed_at ASC)
  WHERE status = 'storage_processing';
