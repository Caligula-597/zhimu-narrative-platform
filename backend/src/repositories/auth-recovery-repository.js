export const AUTH_RECOVERY_USER_FIELDS =
  "id, email, display_name, email_verified_at, user_kind";

export async function configureAuthRecoveryTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '10000ms', true)`
  );
}

export async function lockRegisteredUserByEmail(client, email) {
  const result = await client.query(
    `SELECT ${AUTH_RECOVERY_USER_FIELDS}
     FROM users
     WHERE email = $1 AND user_kind = 'registered'
     FOR UPDATE`,
    [email]
  );
  return result.rows[0] ?? null;
}

export async function lockRecoveryUserById(client, userId) {
  const result = await client.query(
    `SELECT ${AUTH_RECOVERY_USER_FIELDS}
     FROM users
     WHERE id = $1
     FOR UPDATE`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function invalidatePasswordResetTokens(client, userId) {
  await client.query(
    `UPDATE password_reset_tokens
     SET used_at = now()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );
}

export async function insertPasswordResetToken(client, { userId, tokenHash, expiresAt }) {
  await client.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

export async function findPasswordResetUserId(client, tokenHash) {
  const result = await client.query(
    `SELECT user_id
     FROM password_reset_tokens
     WHERE token_hash = $1 AND expires_at > now() AND used_at IS NULL`,
    [tokenHash]
  );
  return result.rows[0]?.user_id ?? null;
}

export async function consumePasswordResetToken(client, tokenHash) {
  const result = await client.query(
    `UPDATE password_reset_tokens
     SET used_at = now()
     WHERE token_hash = $1 AND expires_at > now() AND used_at IS NULL
     RETURNING user_id`,
    [tokenHash]
  );
  return result.rows[0]?.user_id ?? null;
}

export async function updatePasswordAndRevokeSessions(
  client,
  { userId, passwordHash, passwordSalt }
) {
  const updated = await client.query(
    `UPDATE users
     SET password_hash = $2,
         password_salt = $3,
         user_kind = 'registered',
         updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [userId, passwordHash, passwordSalt]
  );
  if (!updated.rowCount) return false;
  await client.query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId]);
  return true;
}

export async function invalidateEmailVerificationTokens(client, userId) {
  await client.query(
    `UPDATE email_verification_tokens
     SET used_at = now()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );
}

export async function insertEmailVerificationToken(client, {
  userId,
  tokenHash,
  expiresAt,
  challengeId,
  codeHash,
  codeExpiresAt,
  lastSentAt
}) {
  await client.query(
    `INSERT INTO email_verification_tokens (
       user_id, token_hash, expires_at, challenge_id,
       verification_code_hash, verification_code_expires_at, last_sent_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, tokenHash, expiresAt, challengeId, codeHash, codeExpiresAt, lastSentAt]
  );
}

export async function findEmailVerificationUserId(client, tokenHash) {
  const result = await client.query(
    `SELECT user_id
     FROM email_verification_tokens
     WHERE token_hash = $1 AND expires_at > now() AND used_at IS NULL`,
    [tokenHash]
  );
  return result.rows[0]?.user_id ?? null;
}

export async function consumeEmailVerificationToken(client, tokenHash) {
  const result = await client.query(
    `UPDATE email_verification_tokens
     SET used_at = now()
     WHERE token_hash = $1 AND expires_at > now() AND used_at IS NULL
     RETURNING user_id`,
    [tokenHash]
  );
  return result.rows[0]?.user_id ?? null;
}

export async function findActiveEmailVerificationChallengeForUser(client, userId) {
  const result = await client.query(
    `SELECT challenge_id, verification_code_expires_at, last_sent_at
     FROM email_verification_tokens
     WHERE user_id = $1 AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  const row = result.rows[0];
  return row
    ? {
        challengeId: row.challenge_id,
        codeExpiresAt: row.verification_code_expires_at,
        lastSentAt: row.last_sent_at
      }
    : null;
}

export async function findEmailVerificationChallengeUserId(client, challengeId) {
  const result = await client.query(
    `SELECT user_id
     FROM email_verification_tokens
     WHERE challenge_id = $1 AND used_at IS NULL`,
    [challengeId]
  );
  return result.rows[0]?.user_id ?? null;
}

export async function lockEmailVerificationChallenge(client, challengeId) {
  const result = await client.query(
    `SELECT token.id, token.user_id, token.challenge_id,
            token.verification_code_hash, token.verification_code_expires_at,
            token.failed_attempts, token.last_sent_at, token.expires_at,
            users.email, users.email_verified_at
     FROM email_verification_tokens token
     JOIN users ON users.id = token.user_id
     WHERE token.challenge_id = $1 AND token.used_at IS NULL
     FOR UPDATE OF token`,
    [challengeId]
  );
  return result.rows[0] ?? null;
}

export async function recordFailedEmailVerificationCode(client, tokenId) {
  const result = await client.query(
    `UPDATE email_verification_tokens
     SET failed_attempts = failed_attempts + 1
     WHERE id = $1 AND used_at IS NULL
     RETURNING failed_attempts`,
    [tokenId]
  );
  return result.rows[0]?.failed_attempts ?? null;
}

export async function consumeEmailVerificationChallenge(client, tokenId) {
  const result = await client.query(
    `UPDATE email_verification_tokens
     SET used_at = now()
     WHERE id = $1 AND used_at IS NULL
     RETURNING user_id`,
    [tokenId]
  );
  return result.rows[0]?.user_id ?? null;
}

export async function rotateEmailVerificationChallenge(client, {
  tokenId,
  tokenHash,
  expiresAt,
  codeHash,
  codeExpiresAt,
  lastSentAt
}) {
  const result = await client.query(
    `UPDATE email_verification_tokens
     SET token_hash = $2,
         expires_at = $3,
         verification_code_hash = $4,
         verification_code_expires_at = $5,
         failed_attempts = 0,
         last_sent_at = $6
     WHERE id = $1 AND used_at IS NULL
     RETURNING challenge_id`,
    [tokenId, tokenHash, expiresAt, codeHash, codeExpiresAt, lastSentAt]
  );
  return result.rows[0]?.challenge_id ?? null;
}

export async function markRecoveryUserEmailVerified(client, userId) {
  const result = await client.query(
    `UPDATE users
     SET email_verified_at = COALESCE(email_verified_at, now()),
         updated_at = now()
     WHERE id = $1
     RETURNING ${AUTH_RECOVERY_USER_FIELDS}`,
    [userId]
  );
  return result.rows[0] ?? null;
}
