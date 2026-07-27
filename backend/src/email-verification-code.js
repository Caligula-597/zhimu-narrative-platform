import {
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual
} from "node:crypto";
import { createAuthToken, hashAuthToken } from "./auth-token.js";

export const EMAIL_VERIFICATION_LINK_TTL_MS = 24 * 60 * 60 * 1000;
export const EMAIL_VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
export const EMAIL_VERIFICATION_MAX_FAILED_ATTEMPTS = 5;

const developmentSecret = randomBytes(32).toString("hex");

export function hasEmailVerificationCodeSecret(env = process.env) {
  return Buffer.byteLength(String(env.EMAIL_VERIFICATION_CODE_SECRET ?? "").trim(), "utf8") >= 32;
}

function emailVerificationCodeSecret(env = process.env) {
  const configured = String(env.EMAIL_VERIFICATION_CODE_SECRET ?? "").trim();
  if (Buffer.byteLength(configured, "utf8") >= 32) return configured;
  if ((env.NODE_ENV ?? "development") !== "production") return developmentSecret;
  throw new Error("EMAIL_VERIFICATION_CODE_SECRET must contain at least 32 bytes in production");
}

export function createEmailVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashEmailVerificationCode(challengeId, code, env = process.env) {
  return createHmac("sha256", emailVerificationCodeSecret(env))
    .update(`zhimu-email-verification:v1:${challengeId}:${String(code)}`)
    .digest("hex");
}

export function emailVerificationCodeMatches(challengeId, code, expectedHash, env = process.env) {
  if (!expectedHash) return false;
  const actual = Buffer.from(hashEmailVerificationCode(challengeId, code, env), "hex");
  const expected = Buffer.from(String(expectedHash), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createEmailVerificationChallenge(now = Date.now(), challengeId = randomUUID()) {
  const token = createAuthToken();
  const code = createEmailVerificationCode();
  return {
    challengeId,
    token,
    tokenHash: hashAuthToken(token),
    code,
    codeHash: hashEmailVerificationCode(challengeId, code),
    expiresAt: new Date(now + EMAIL_VERIFICATION_LINK_TTL_MS),
    codeExpiresAt: new Date(now + EMAIL_VERIFICATION_CODE_TTL_MS),
    lastSentAt: new Date(now),
    failedAttempts: 0
  };
}

export function maskEmail(email = "") {
  const normalized = String(email).trim().toLowerCase();
  const separator = normalized.lastIndexOf("@");
  if (separator <= 0) return normalized;
  const local = normalized.slice(0, separator);
  const domain = normalized.slice(separator + 1);
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, Math.min(6, local.length - visible.length)))}@${domain}`;
}

export function publicEmailVerificationChallenge(challenge, email, now = Date.now()) {
  if (!challenge?.challengeId) return null;
  const lastSentAt = new Date(challenge.lastSentAt ?? now).getTime();
  const codeExpiresAt = new Date(challenge.codeExpiresAt ?? now).getTime();
  return {
    id: challenge.challengeId,
    maskedEmail: maskEmail(email),
    codeLength: 6,
    expiresAt: new Date(codeExpiresAt).toISOString(),
    expiresInSeconds: Math.max(0, Math.ceil((codeExpiresAt - now) / 1000)),
    resendAfterSeconds: Math.max(
      0,
      Math.ceil((lastSentAt + EMAIL_VERIFICATION_RESEND_COOLDOWN_MS - now) / 1000)
    )
  };
}
