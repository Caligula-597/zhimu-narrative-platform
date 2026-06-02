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
