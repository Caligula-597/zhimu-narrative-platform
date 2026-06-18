/**
 * Account capabilities — single source for account-kind gates.
 * World/room role checks remain in route-guards.js.
 */
import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import { isEmailVerificationRequired, isUserEmailVerified } from "./email-verification-policy.js";
import { requireActor } from "./request-actor.js";

export const USER_KIND = {
  REGISTERED: "registered",
  GUEST: "guest"
};

/** Capability keys referenced by routes and tests. */
export const CAPABILITIES = {
  "account.authenticated": { accountKinds: [USER_KIND.REGISTERED, USER_KIND.GUEST] },
  "world.create": { accountKinds: [USER_KIND.REGISTERED], requireVerifiedEmail: true },
  "world.collaborate": { accountKinds: [USER_KIND.REGISTERED] },
  "world.edit": { accountKinds: [USER_KIND.REGISTERED] },
  "asset.upload": { accountKinds: [USER_KIND.REGISTERED] },
  "room.join": { accountKinds: [USER_KIND.REGISTERED, USER_KIND.GUEST] },
  "room.play": { accountKinds: [USER_KIND.REGISTERED, USER_KIND.GUEST] },
  "room.host": { accountKinds: [USER_KIND.REGISTERED] },
  "platform.social.write": { accountKinds: [USER_KIND.REGISTERED] }
};

export async function fetchUserKind(userId) {
  const result = await query(`SELECT user_kind FROM users WHERE id = $1`, [userId]);
  if (!result.rowCount) throwErr("USER_NOT_FOUND");
  return result.rows[0].user_kind;
}

export async function isGuestUser(userId) {
  return (await fetchUserKind(userId)) === USER_KIND.GUEST;
}

export async function assertCapability(userId, capabilityKey) {
  const spec = CAPABILITIES[capabilityKey];
  if (!spec) {
    const error = new Error(`Unknown capability: ${capabilityKey}`);
    error.statusCode = 500;
    throw error;
  }
  const kind = await fetchUserKind(userId);
  if (!spec.accountKinds.includes(kind)) {
    throwErr(kind === USER_KIND.GUEST ? "GUEST_ACCOUNT_RESTRICTED" : "FORBIDDEN");
  }
  if (spec.requireVerifiedEmail && isEmailVerificationRequired()) {
    if (!(await isUserEmailVerified(userId))) {
      throwErr("EMAIL_NOT_VERIFIED");
    }
  }
  return kind;
}

export function requireCapability(request, capabilityKey) {
  const actorId = requireActor(request);
  return assertCapability(actorId, capabilityKey).then(() => actorId);
}
