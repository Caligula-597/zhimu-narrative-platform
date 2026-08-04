import {
  createSession,
  inferDeviceLabel,
  verifyPassword
} from "./auth.js";
import { hashAuthToken } from "./auth-token.js";
import { throwErr } from "./api-errors.js";
import { normalizeIdentityWriteError } from "./auth-identity-errors.js";
import { transaction } from "./db.js";
import { isEmailVerificationRequired } from "./email-verification-policy.js";
import { publicEmailVerificationChallenge } from "./email-verification-code.js";
import { isInternalBetaEmail } from "./internal-accounts.js";
import { planMeta } from "./plans.js";
import {
  applyIdentityPrivileges,
  configureIdentityTransaction,
  readIdentityUser
} from "./repositories/auth-identity-repository.js";
import {
  deleteIdentitySessionsByHashes,
  findIdentityProfile,
  findLoginCandidate,
  listIdentitySessions,
  lockLoginCandidate,
  revokeIdentitySession,
  revokeOtherIdentitySessions
} from "./repositories/auth-session-repository.js";
import { findActiveEmailVerificationChallengeForUser } from "./repositories/auth-recovery-repository.js";

export async function loginIdentity({ email, password, sessionMeta, transactionRunner = transaction }) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const candidate = await findLoginCandidate(normalizedEmail);
  const valid = await verifyPassword(
    password,
    candidate?.password_hash ?? null,
    candidate?.password_salt ?? null
  );
  if (!candidate || !valid) throwErr("INVALID_CREDENTIALS");

  try {
    return await transactionRunner(async (client) => {
      await configureIdentityTransaction(client);
      const locked = await lockLoginCandidate(client, candidate.id);
      if (!locked
        || locked.password_hash !== candidate.password_hash
        || locked.password_salt !== candidate.password_salt) {
        throwErr("INVALID_CREDENTIALS");
      }
      await applyIdentityPrivileges(client, {
        userId: locked.id,
        internalBeta: isInternalBetaEmail(locked.email),
        currentPlan: locked.plan_code
      });
      const user = await readIdentityUser(client, locked.id);
      const session = await createSession(user.id, sessionMeta, {
        executor: client.query.bind(client)
      });
      const pendingEmailVerification = isEmailVerificationRequired() && !user.email_verified_at;
      const verificationChallenge = pendingEmailVerification
        ? await findActiveEmailVerificationChallengeForUser(client, user.id)
        : null;
      return {
        user,
        session,
        pendingEmailVerification,
        verificationChallenge: verificationChallenge
          ? publicEmailVerificationChallenge(verificationChallenge, user.email)
          : null
      };
    });
  } catch (error) {
    throw normalizeIdentityWriteError(error);
  }
}

export async function getIdentityProfile(userId) {
  const row = await findIdentityProfile(userId);
  if (!row) throwErr("USER_NOT_FOUND");
  const { plan_code: planCode, ...profile } = row;
  const meta = planMeta(planCode);
  return {
    ...profile,
    userKind: row.user_kind,
    isGuest: row.user_kind === "guest",
    emailVerified: Boolean(row.email_verified_at),
    planCode,
    planLabel: meta.label,
    planTier: meta.tier,
    isInternalBeta: planCode === "beta"
  };
}

export async function getIdentitySessions(userId, currentSessionId = null) {
  const rows = await listIdentitySessions(userId, currentSessionId);
  return rows.map((row) => ({
    id: row.id,
    deviceLabel: inferDeviceLabel(row.user_agent, row.device_label),
    userAgent: row.user_agent,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    isCurrent: row.is_current
  }));
}

export async function revokeIdentitySessionById({ userId, sessionId, currentSessionId }) {
  const revoked = await revokeIdentitySession({ userId, sessionId, currentSessionId });
  if (!revoked) throwErr("SESSION_NOT_FOUND");
  return { currentSessionRevoked: sessionId === currentSessionId };
}

export async function logoutOtherIdentitySessions(userId, currentSessionId = null) {
  await revokeOtherIdentitySessions(userId, currentSessionId);
  return { currentSessionKept: Boolean(currentSessionId) };
}

export async function logoutIdentityTokens(tokens) {
  const hashes = [...new Set(tokens.filter(Boolean).map(hashAuthToken))];
  await deleteIdentitySessionsByHashes(hashes);
}
