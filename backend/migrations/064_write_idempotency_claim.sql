-- Harden write_idempotency for concurrent claim semantics.
-- Existing completed rows keep response; new claims may start with status=processing and null response.

ALTER TABLE write_idempotency
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS request_hash text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE write_idempotency
  ALTER COLUMN response DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'write_idempotency_status_check'
  ) THEN
    ALTER TABLE write_idempotency
      ADD CONSTRAINT write_idempotency_status_check
      CHECK (status IN ('processing', 'completed', 'failed'));
  END IF;
END $$;

UPDATE write_idempotency
SET status = 'completed', updated_at = COALESCE(updated_at, created_at)
WHERE status IS NULL OR status = '';

CREATE INDEX IF NOT EXISTS idx_write_idempotency_processing
  ON write_idempotency (updated_at)
  WHERE status = 'processing';
