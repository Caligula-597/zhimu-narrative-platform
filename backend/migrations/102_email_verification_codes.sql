ALTER TABLE email_verification_tokens
  ADD COLUMN IF NOT EXISTS challenge_id uuid,
  ADD COLUMN IF NOT EXISTS verification_code_hash text,
  ADD COLUMN IF NOT EXISTS verification_code_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;

UPDATE email_verification_tokens
SET challenge_id = COALESCE(challenge_id, gen_random_uuid()),
    last_sent_at = COALESCE(last_sent_at, created_at)
WHERE challenge_id IS NULL OR last_sent_at IS NULL;

ALTER TABLE email_verification_tokens
  ALTER COLUMN challenge_id SET NOT NULL,
  ALTER COLUMN challenge_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN last_sent_at SET NOT NULL,
  ALTER COLUMN last_sent_at SET DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS email_verification_tokens_challenge_id_key
  ON email_verification_tokens(challenge_id);

CREATE INDEX IF NOT EXISTS email_verification_tokens_code_expiry_idx
  ON email_verification_tokens(challenge_id, verification_code_expires_at)
  WHERE used_at IS NULL;

ALTER TABLE email_verification_tokens
  DROP CONSTRAINT IF EXISTS email_verification_tokens_failed_attempts_check;

ALTER TABLE email_verification_tokens
  ADD CONSTRAINT email_verification_tokens_failed_attempts_check
  CHECK (failed_attempts >= 0);
