import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import { USER_KIND } from "./capabilities.js";
import { ensureUserPlan, initialPlanForEmail } from "./plans.js";

const scrypt = promisify(scryptCallback);
const DUMMY_PASSWORD_SALT = "00000000000000000000000000000000";
const DUMMY_PASSWORD_HASH = "a79be277f4164331643603688348e47bf86ce3900a63b8bc1a837c090f25b555cda39a106f0a1b8766ca7678fda8c3615c23c3b3b0c6b71e24b5628cb8f99a07";

const REGISTERED_SESSION_MS = (Number(process.env.SESSION_TTL_DAYS) || 30) * 24 * 60 * 60 * 1000;
const GUEST_SESSION_MS = (Number(process.env.GUEST_SESSION_TTL_DAYS) || 7) * 24 * 60 * 60 * 1000;

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashClientIp(ip) {
  if (!ip) return null;
  return createHash("sha256").update(String(ip)).digest("hex").slice(0, 32);
}

export function inferDeviceLabel(userAgent, deviceLabel = null) {
  const explicit = typeof deviceLabel === "string" ? deviceLabel.trim().slice(0, 80) : "";
  if (explicit) return explicit;
  const ua = userAgent || "";
  let browser = "浏览器";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";
  let os = "";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  return os ? `${browser} · ${os}` : browser;
}

export function sessionRequestMeta(request) {
  const bodyLabel = request.body?.deviceLabel;
  const headerLabel = request.headers["x-device-label"];
  const userAgent = request.headers["user-agent"]?.slice(0, 512) || null;
  const rawLabel = (typeof bodyLabel === "string" ? bodyLabel : headerLabel)?.trim().slice(0, 80) || null;
  return {
    deviceLabel: rawLabel || inferDeviceLabel(userAgent),
    userAgent,
    ipHash: hashClientIp(request.ip)
  };
}

async function revokeMatchingDeviceSessions(userId, meta = {}) {
  const { deviceLabel, userAgent } = meta;
  if (deviceLabel) {
    await query(
      `UPDATE auth_sessions SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL
         AND (device_label = $2 OR (device_label IS NULL AND user_agent IS NOT DISTINCT FROM $3))`,
      [userId, deviceLabel, userAgent ?? null]
    );
    return;
  }
  if (userAgent) {
    await query(
      `UPDATE auth_sessions SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL AND user_agent IS NOT DISTINCT FROM $2`,
      [userId, userAgent]
    );
  }
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return { passwordHash: Buffer.from(derived).toString("hex"), passwordSalt: salt };
}

export async function verifyPassword(password, passwordHash, passwordSalt) {
  const hasStoredCredential = Boolean(passwordHash && passwordSalt);
  const derived = Buffer.from(await scrypt(password, passwordSalt || DUMMY_PASSWORD_SALT, 64));
  const expected = Buffer.from(passwordHash || DUMMY_PASSWORD_HASH, "hex");
  const matches = derived.length === expected.length && timingSafeEqual(derived, expected);
  return hasStoredCredential && matches;
}

async function sessionTtlForUser(userId) {
  const result = await query(`SELECT user_kind FROM users WHERE id = $1`, [userId]);
  return result.rows[0]?.user_kind === USER_KIND.GUEST ? GUEST_SESSION_MS : REGISTERED_SESSION_MS;
}

export async function createGuestUser(displayName = null) {
  const suffix = randomBytes(3).toString("hex");
  const name = (displayName?.trim() || `游客-${suffix}`).slice(0, 40);
  const created = await query(
    `INSERT INTO users (display_name, user_kind, email)
     VALUES ($1, 'guest', NULL)
     RETURNING id, display_name, user_kind, email, email_verified_at`,
    [name]
  );
  const user = created.rows[0];
  await ensureUserPlan(user.id, initialPlanForEmail(null));
  return user;
}

export async function createSession(userId, meta = {}) {
  await revokeMatchingDeviceSessions(userId, meta);
  const token = randomBytes(32).toString("base64url");
  const ttlMs = meta.ttlMs ?? await sessionTtlForUser(userId);
  const expiresAt = new Date(Date.now() + ttlMs);
  const result = await query(
    `INSERT INTO auth_sessions (user_id, token_hash, expires_at, device_label, user_agent, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      userId,
      tokenHash(token),
      expiresAt,
      meta.deviceLabel ?? null,
      meta.userAgent ?? null,
      meta.ipHash ?? null
    ]
  );
  return { token, expiresAt, sessionId: result.rows[0].id };
}

export async function resolveSession(token) {
  const ctx = await resolveSessionContext(token);
  return ctx?.userId ?? null;
}

export async function resolveSessionContext(token) {
  if (!token) return null;
  const touchSeconds = resolveSessionTouchIntervalSeconds();
  const result = await query(
    `WITH valid AS MATERIALIZED (
       SELECT user_id, id, last_seen_at
       FROM auth_sessions
       WHERE token_hash = $1
         AND expires_at > now()
         AND revoked_at IS NULL
     ), touched AS (
       UPDATE auth_sessions target
       SET last_seen_at = now()
       FROM valid
       WHERE target.id = valid.id
         AND COALESCE(valid.last_seen_at, '-infinity'::timestamptz) < now() - ($2::int * interval '1 second')
       RETURNING target.id
     )
     SELECT user_id, id AS session_id FROM valid`,
    [tokenHash(token), touchSeconds]
  );
  const row = result.rows[0];
  if (!row) return null;
  return { userId: row.user_id, sessionId: row.session_id };
}

export function resolveSessionTouchIntervalSeconds(raw = process.env.SESSION_LAST_SEEN_TOUCH_SECONDS) {
  const value = Number(raw ?? 300);
  return Number.isInteger(value) && value >= 30 && value <= 24 * 60 * 60 ? value : 300;
}

export async function deleteSession(token) {
  if (token) {
    await query(`DELETE FROM auth_sessions WHERE token_hash = $1`, [tokenHash(token)]);
  }
}

export async function revokeSessionById(userId, sessionId, { allowCurrent = true } = {}) {
  const result = await query(
    `UPDATE auth_sessions SET revoked_at = now()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [sessionId, userId]
  );
  if (!result.rowCount) return false;
  if (!allowCurrent) return true;
  return true;
}

export async function listUserSessions(userId, currentSessionId = null) {
  const result = await query(
    `SELECT id, device_label, user_agent, created_at, last_seen_at, expires_at,
            (id = $2) AS is_current
     FROM auth_sessions
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
     ORDER BY last_seen_at DESC`,
    [userId, currentSessionId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    deviceLabel: inferDeviceLabel(row.user_agent, row.device_label),
    userAgent: row.user_agent,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    isCurrent: row.is_current
  }));
}

export async function revokeAllSessions(userId, exceptSessionId = null) {
  if (exceptSessionId) {
    await query(
      `UPDATE auth_sessions SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL AND id <> $2`,
      [userId, exceptSessionId]
    );
    return;
  }
  await query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId]);
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
    `UPDATE users SET password_hash = $1, password_salt = $2, user_kind = 'registered' WHERE id = $3`,
    [passwordHash, passwordSalt, userId]
  );
}

export async function upgradeGuestToRegistered(userId, { email, displayName, password }) {
  const existing = await query(
    `SELECT id, user_kind FROM users WHERE id = $1`,
    [userId]
  );
  if (!existing.rowCount) throwErr("USER_NOT_FOUND");
  if (existing.rows[0].user_kind !== USER_KIND.GUEST) {
    throwErr("ACCOUNT_ALREADY_REGISTERED");
  }

  const emailTaken = await query(
    `SELECT 1 FROM users WHERE lower(email) = lower($1) AND id <> $2 AND user_kind = 'registered'`,
    [email, userId]
  );
  if (emailTaken.rowCount) throwErr("EMAIL_ALREADY_REGISTERED");

  const { passwordHash, passwordSalt } = await hashPassword(password);
  const updated = await query(
    `UPDATE users
     SET email = $2,
         display_name = $3,
         password_hash = $4,
         password_salt = $5,
         user_kind = 'registered',
         email_verified_at = COALESCE(email_verified_at, now()),
         updated_at = now()
     WHERE id = $1 AND user_kind = 'guest'
     RETURNING id, email, display_name, user_kind, email_verified_at`,
    [userId, email.trim().toLowerCase(), displayName.trim(), passwordHash, passwordSalt]
  );
  if (!updated.rowCount) throwErr("GUEST_UPGRADE_FAILED");
  await query(
    `INSERT INTO storage_quotas (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  return updated.rows[0];
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
