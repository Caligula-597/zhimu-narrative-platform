/**
 * Internal beta accounts — elevated plan + optional email verification bypass.
 * Configure via INTERNAL_BETA_EMAILS and INTERNAL_BETA_EMAIL_DOMAINS (comma-separated).
 */
import { markUserEmailVerified } from "./email-verification-policy.js";
import { setUserPlan } from "./plans.js";

const DEFAULT_BETA_DOMAINS = ["zhimu.local"];

function parseList(raw) {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function betaEmailAllowlist() {
  return parseList(process.env.INTERNAL_BETA_EMAILS);
}

function betaEmailDomains() {
  const fromEnv = parseList(process.env.INTERNAL_BETA_EMAIL_DOMAINS);
  return [...new Set([...DEFAULT_BETA_DOMAINS, ...fromEnv])];
}

export function isInternalBetaEmail(email) {
  if (!email || typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;
  if (betaEmailAllowlist().includes(normalized)) return true;
  const domain = normalized.split("@")[1];
  return betaEmailDomains().some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** Assign beta plan and mark email verified for internal testers. Idempotent. */
export async function applyInternalBetaPrivileges(userId, email) {
  if (!isInternalBetaEmail(email)) return false;
  await setUserPlan(userId, "beta");
  await markUserEmailVerified(userId);
  return true;
}
