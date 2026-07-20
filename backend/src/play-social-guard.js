import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import { hashClientIp } from "./auth.js";
import { assertCapability } from "./capabilities.js";
import { isEmailVerificationRequired, isUserEmailVerified } from "./email-verification-policy.js";

export function isPlaySocialGuestWriteAllowed() {
  return process.env.PLAY_SOCIAL_GUEST_WRITE === "true";
}

export function isPlaySocialVerifiedEmailRequired() {
  if (process.env.PLAY_SOCIAL_REQUIRE_VERIFIED_EMAIL === "false") return false;
  if (process.env.PLAY_SOCIAL_REQUIRE_VERIFIED_EMAIL === "true") return true;
  return isEmailVerificationRequired() || (process.env.NODE_ENV ?? "development") === "production";
}

function socialAccountCooldownMinutes() {
  const raw = Number(process.env.PLAY_SOCIAL_ACCOUNT_COOLDOWN_MIN);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return 10;
}

export async function assertPlaySocialWrite(actorId) {
  if (isPlaySocialGuestWriteAllowed()) {
    await assertCapability(actorId, "account.authenticated");
  } else {
    await assertCapability(actorId, "platform.social.write");
  }
  if (isPlaySocialVerifiedEmailRequired() && !(await isUserEmailVerified(actorId))) {
    throwErr("EMAIL_NOT_VERIFIED", "使用社区功能前请先验证邮箱。");
  }
  const cooldownMin = socialAccountCooldownMinutes();
  if (cooldownMin > 0) {
    const row = await query(`SELECT created_at FROM users WHERE id = $1`, [actorId]);
    if (!row.rowCount) throwErr("USER_NOT_FOUND");
    const ageMs = Date.now() - new Date(row.rows[0].created_at).getTime();
    if (ageMs < cooldownMin * 60_000) {
      throwErr("PLAY_SOCIAL_ACCOUNT_TOO_NEW", `新注册账号需等待 ${cooldownMin} 分钟后才能使用社区功能。`);
    }
  }
}

export async function countGuestUsersForIp(ipHash, { windowHours = 1 } = {}) {
  if (!ipHash) return 0;
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM auth_account_creation_events
     WHERE account_kind = 'guest'
       AND ip_hash = $1
       AND created_at > now() - ($2::text || ' hours')::interval`,
    [ipHash, String(windowHours)]
  );
  return result.rows[0]?.count ?? 0;
}

export async function countRegisteredUsersForIp(ipHash, { windowHours = 24 } = {}) {
  if (!ipHash) return 0;
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM auth_account_creation_events
     WHERE account_kind = 'registered'
       AND ip_hash = $1
       AND created_at > now() - ($2::text || ' hours')::interval`,
    [ipHash, String(windowHours)]
  );
  return result.rows[0]?.count ?? 0;
}

export async function assertGuestCreationAllowed(request) {
  const ipHash = hashClientIp(request.ip);
  const hourMax = Number(process.env.GUEST_CREATE_HOUR_MAX ?? 3);
  const dayMax = Number(process.env.GUEST_CREATE_DAY_MAX ?? 8);
  if (hourMax <= 0 && dayMax <= 0) return;
  const hourCount = await countGuestUsersForIp(ipHash, { windowHours: 1 });
  if (hourMax > 0 && hourCount >= hourMax) {
    throwErr("GUEST_CREATE_RATE_LIMITED", "当前网络创建游客账号过于频繁，请稍后再试或注册登录。");
  }
  const dayCount = await countGuestUsersForIp(ipHash, { windowHours: 24 });
  if (dayMax > 0 && dayCount >= dayMax) {
    throwErr("GUEST_CREATE_RATE_LIMITED", "今日游客账号创建已达上限，请注册登录后继续。");
  }
}

export async function assertRegistrationAllowed(request) {
  const dayMax = Number(process.env.REGISTER_IP_DAY_MAX ?? 5);
  if (dayMax <= 0) return;
  const ipHash = hashClientIp(request.ip);
  const dayCount = await countRegisteredUsersForIp(ipHash, { windowHours: 24 });
  if (dayCount >= dayMax) {
    throwErr("REGISTER_IP_RATE_LIMITED", "当前网络注册过于频繁，请稍后再试。");
  }
}
