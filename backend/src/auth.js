import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { query } from "./db.js";
import { createAuthToken, hashAuthToken } from "./auth-token.js";
import { USER_KIND } from "./capabilities.js";
import { isEmailVerificationRequired } from "./email-verification-policy.js";

const scrypt = promisify(scryptCallback);
const DUMMY_PASSWORD_SALT = "00000000000000000000000000000000";
const DUMMY_PASSWORD_HASH = "a79be277f4164331643603688348e47bf86ce3900a63b8bc1a837c090f25b555cda39a106f0a1b8766ca7678fda8c3615c23c3b3b0c6b71e24b5628cb8f99a07";

const production = (process.env.NODE_ENV ?? "development") === "production";
const REGISTERED_SESSION_MS =
  (Number(process.env.SESSION_TTL_DAYS) || (production ? 1 : 30)) * 24 * 60 * 60 * 1000;
const GUEST_SESSION_MS =
  (Number(process.env.GUEST_SESSION_TTL_DAYS) || (production ? 1 : 7)) * 24 * 60 * 60 * 1000;

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

async function revokeMatchingDeviceSessions(userId, meta = {}, executor = query) {
  const { deviceLabel, userAgent } = meta;
  if (deviceLabel) {
    await executor(
      `UPDATE auth_sessions SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL
         AND (device_label = $2 OR (device_label IS NULL AND user_agent IS NOT DISTINCT FROM $3))`,
      [userId, deviceLabel, userAgent ?? null]
    );
    return;
  }
  if (userAgent) {
    await executor(
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

async function sessionTtlForUser(userId, executor = query) {
  const result = await executor(`SELECT user_kind FROM users WHERE id = $1`, [userId]);
  return result.rows[0]?.user_kind === USER_KIND.GUEST ? GUEST_SESSION_MS : REGISTERED_SESSION_MS;
}

export async function createSession(userId, meta = {}, { executor = query } = {}) {
  await revokeMatchingDeviceSessions(userId, meta, executor);
  const token = createAuthToken();
  const ttlMs = meta.ttlMs ?? await sessionTtlForUser(userId, executor);
  const expiresAt = new Date(Date.now() + ttlMs);
  const result = await executor(
    `INSERT INTO auth_sessions (user_id, token_hash, expires_at, device_label, user_agent, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      userId,
      hashAuthToken(token),
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
  const verificationRequired = isEmailVerificationRequired();
  const result = await query(
    `WITH valid AS MATERIALIZED (
       SELECT session.user_id, session.id, session.last_seen_at
       FROM auth_sessions session
       INNER JOIN users identity ON identity.id = session.user_id
       WHERE session.token_hash = $1
         AND session.expires_at > now()
         AND session.revoked_at IS NULL
         AND (
           $3::boolean = false
           OR identity.user_kind = 'guest'
           OR identity.email_verified_at IS NOT NULL
         )
     ), touched AS (
       UPDATE auth_sessions target
       SET last_seen_at = now()
       FROM valid
       WHERE target.id = valid.id
         AND COALESCE(valid.last_seen_at, '-infinity'::timestamptz) < now() - ($2::int * interval '1 second')
       RETURNING target.id
     )
     SELECT user_id, id AS session_id FROM valid`,
    [hashAuthToken(token), touchSeconds, verificationRequired]
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
    await query(`DELETE FROM auth_sessions WHERE token_hash = $1`, [hashAuthToken(token)]);
  }
}
