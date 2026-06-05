import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { query } from "./db.js";

const scrypt = promisify(scryptCallback);

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return { passwordHash: Buffer.from(derived).toString("hex"), passwordSalt: salt };
}

export async function verifyPassword(password, passwordHash, passwordSalt) {
  if (!passwordHash || !passwordSalt) return false;
  const derived = Buffer.from(await scrypt(password, passwordSalt, 64));
  const expected = Buffer.from(passwordHash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export async function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await query(`INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`, [userId, tokenHash(token), expiresAt]);
  return { token, expiresAt };
}

export async function resolveSession(token) {
  if (!token) return null;
  const result = await query(
    `UPDATE auth_sessions SET last_seen_at = now()
     WHERE token_hash = $1 AND expires_at > now()
     RETURNING user_id`,
    [tokenHash(token)]
  );
  return result.rows[0]?.user_id ?? null;
}

export async function deleteSession(token) {
  if (token) await query(`DELETE FROM auth_sessions WHERE token_hash = $1`, [tokenHash(token)]);
}

export async function createPasswordResetToken(userId) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await query(
    `UPDATE password_reset_tokens SET used_at = now()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
    [userId, tokenHash(token), expiresAt]
  );
  return { token, expiresAt };
}

export async function consumePasswordResetToken(token) {
  const result = await query(
    `UPDATE password_reset_tokens SET used_at = now()
     WHERE token_hash = $1 AND expires_at > now() AND used_at IS NULL
     RETURNING user_id`,
    [tokenHash(token)]
  );
  return result.rows[0]?.user_id ?? null;
}

export async function updateUserPassword(userId, password) {
  const { passwordHash, passwordSalt } = await hashPassword(password);
  await query(
    `UPDATE users SET password_hash = $1, password_salt = $2 WHERE id = $3`,
    [passwordHash, passwordSalt, userId]
  );
}

export async function revokeAllSessions(userId) {
  await query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId]);
}

export async function createEmailVerificationToken(userId) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await query(
    `UPDATE email_verification_tokens SET used_at = now()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );
  await query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
    [userId, tokenHash(token), expiresAt]
  );
  return { token, expiresAt };
}

export async function consumeEmailVerificationToken(token) {
  const result = await query(
    `UPDATE email_verification_tokens SET used_at = now()
     WHERE token_hash = $1 AND expires_at > now() AND used_at IS NULL
     RETURNING user_id`,
    [tokenHash(token)]
  );
  return result.rows[0]?.user_id ?? null;
}
