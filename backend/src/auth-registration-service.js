import { randomBytes } from "node:crypto";
import { createSession, hashClientIp, hashPassword } from "./auth.js";
import { createAuthToken, hashAuthToken } from "./auth-token.js";
import { throwErr } from "./api-errors.js";
import { normalizeIdentityWriteError } from "./auth-identity-errors.js";
import { transaction } from "./db.js";
import { isEmailConfigured, sendEmailVerificationEmail } from "./email.js";
import { isEmailVerificationRequired } from "./email-verification-policy.js";
import { isInternalBetaEmail } from "./internal-accounts.js";
import {
  acceptPendingWorldInvitesForVerifiedUser,
  applyIdentityPrivileges,
  configureIdentityTransaction,
  ensureIdentityFoundation
} from "./repositories/auth-identity-repository.js";
import {
  countRecentAccountCreations,
  countRecentGuestAccountCreations,
  findRegisteredUserByEmail,
  insertGuestUser,
  insertRegisteredUser,
  lockAccountCreationRate,
  lockRegistrationUser,
  recordAccountCreation,
  revokeAllIdentitySessions,
  upgradeGuestUser
} from "./repositories/auth-registration-repository.js";
import {
  insertEmailVerificationToken,
  invalidateEmailVerificationTokens
} from "./repositories/auth-recovery-repository.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const EMAIL_DELIVERY_WAIT_MS = 8_000;

function boundedLimit(raw, fallback) {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value >= 0 && value <= 100_000 ? value : fallback;
}

function normalizeRegistrationInput({ email, displayName, password }) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const normalizedDisplayName = String(displayName ?? "").trim();
  if (!EMAIL_PATTERN.test(normalizedEmail)) throwErr("EMAIL_INVALID");
  if (normalizedDisplayName.length < 2) throwErr("DISPLAY_NAME_INVALID");
  return { email: normalizedEmail, displayName: normalizedDisplayName, password };
}

function verificationState(email) {
  const internalBeta = isInternalBetaEmail(email);
  const verificationRequired = isEmailVerificationRequired();
  const emailVerified = internalBeta || !verificationRequired;
  if (!emailVerified && !isEmailConfigured()) throwErr("EMAIL_NOT_CONFIGURED");
  if (emailVerified) {
    return { internalBeta, verificationRequired, emailVerified, challenge: null };
  }
  const token = createAuthToken();
  return {
    internalBeta,
    verificationRequired,
    emailVerified,
    challenge: {
      token,
      tokenHash: hashAuthToken(token),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS)
    }
  };
}

export function existingRegistrationErrorCode(existingUser) {
  if (!existingUser) return null;
  return existingUser.email_verified_at
    ? "EMAIL_ALREADY_REGISTERED"
    : "EMAIL_VERIFICATION_PENDING";
}

async function enforceAccountCreationLimit(client, { ipHash, accountKind }) {
  await lockAccountCreationRate(client, { ipHash, accountKind });
  if (accountKind === "registered") {
    const dayMax = boundedLimit(process.env.REGISTER_IP_DAY_MAX, 5);
    if (dayMax <= 0) return;
    const count = await countRecentAccountCreations(client, {
      ipHash,
      accountKind,
      windowHours: 24
    });
    if (count >= dayMax) throwErr("REGISTER_IP_RATE_LIMITED");
    return;
  }

  const hourMax = boundedLimit(process.env.GUEST_CREATE_HOUR_MAX, 3);
  const dayMax = boundedLimit(process.env.GUEST_CREATE_DAY_MAX, 8);
  if (hourMax <= 0 && dayMax <= 0) return;
  const { hourCount, dayCount } = await countRecentGuestAccountCreations(client, { ipHash });
  if (hourMax > 0 && hourCount >= hourMax) throwErr("GUEST_CREATE_RATE_LIMITED");
  if (dayMax > 0 && dayCount >= dayMax) throwErr("GUEST_CREATE_RATE_LIMITED");
}

export async function deliverVerificationChallenge({
  user,
  challenge,
  logger,
  sendVerificationEmail = sendEmailVerificationEmail,
  deliveryWaitMs = boundedLimit(process.env.EMAIL_DELIVERY_WAIT_MS, EMAIL_DELIVERY_WAIT_MS)
}) {
  if (!challenge) return null;
  let timeout;
  try {
    const delivery = Promise.resolve(
      sendVerificationEmail({ to: user.email, verifyToken: challenge.token })
    );
    if (deliveryWaitMs > 0) {
      await Promise.race([
        delivery,
        new Promise((_, reject) => {
          timeout = setTimeout(() => {
            reject(Object.assign(new Error("Verification email delivery confirmation timed out"), {
              code: "EMAIL_DELIVERY_TIMEOUT"
            }));
          }, deliveryWaitMs);
        })
      ]);
    } else {
      await delivery;
    }
    return true;
  } catch (error) {
    logger?.error?.({ err: error, userId: user.id }, "registration verification email failed");
    // Delivery can be ambiguous after an upstream timeout. Keep the token valid;
    // a later resend atomically replaces it.
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function registerIdentity({
  body,
  ip,
  sessionMeta,
  logger,
  sendVerificationEmail = sendEmailVerificationEmail,
  transactionRunner = transaction
}) {
  const input = normalizeRegistrationInput(body);
  const state = verificationState(input.email);
  const credentials = await hashPassword(input.password);
  const ipHash = hashClientIp(ip || "unknown");
  try {
    const result = await transactionRunner(async (client) => {
      await configureIdentityTransaction(client);
      const existingUser = await findRegisteredUserByEmail(client, input.email);
      const existingErrorCode = existingRegistrationErrorCode(existingUser);
      if (existingErrorCode) throwErr(existingErrorCode);
      await enforceAccountCreationLimit(client, { ipHash, accountKind: "registered" });
      const created = await insertRegisteredUser(client, {
        ...input,
        ...credentials,
        emailVerified: state.emailVerified
      });
      await ensureIdentityFoundation(client, {
        userId: created.id,
        planCode: state.internalBeta ? "beta" : "free"
      });
      await applyIdentityPrivileges(client, {
        userId: created.id,
        internalBeta: state.internalBeta,
        currentPlan: state.internalBeta ? "beta" : "free"
      });
      const user = created;
      const acceptedInvites = user.email_verified_at
        ? await acceptPendingWorldInvitesForVerifiedUser(client, { userId: user.id, email: user.email })
        : [];
      if (state.challenge) {
        await insertEmailVerificationToken(client, {
          userId: user.id,
          tokenHash: state.challenge.tokenHash,
          expiresAt: state.challenge.expiresAt
        });
      }
      const session = state.challenge
        ? null
        : await createSession(user.id, sessionMeta, { executor: client.query.bind(client) });
      await recordAccountCreation(client, {
        userId: user.id,
        ipHash,
        accountKind: "registered"
      });
      return { user, acceptedInvites, session };
    });
    const verificationEmailSent = await deliverVerificationChallenge({
      user: result.user,
      challenge: state.challenge,
      logger,
      sendVerificationEmail
    });
    return {
      ...result,
      pendingEmailVerification: Boolean(state.challenge),
      verificationEmailSent
    };
  } catch (error) {
    throw normalizeIdentityWriteError(error);
  }
}

export async function createGuestIdentity({
  displayName,
  ip,
  sessionMeta,
  transactionRunner = transaction
}) {
  const suffix = randomBytes(3).toString("hex");
  const name = (String(displayName ?? "").trim() || `Guest-${suffix}`).slice(0, 40);
  const ipHash = hashClientIp(ip || "unknown");
  try {
    return await transactionRunner(async (client) => {
      await configureIdentityTransaction(client);
      await enforceAccountCreationLimit(client, { ipHash, accountKind: "guest" });
      const user = await insertGuestUser(client, name);
      await ensureIdentityFoundation(client, { userId: user.id, planCode: "free" });
      const session = await createSession(user.id, sessionMeta, {
        executor: client.query.bind(client)
      });
      await recordAccountCreation(client, { userId: user.id, ipHash, accountKind: "guest" });
      return { user, session };
    });
  } catch (error) {
    throw normalizeIdentityWriteError(error);
  }
}

export async function upgradeGuestIdentity({
  actorId,
  body,
  ip,
  sessionMeta,
  logger,
  sendVerificationEmail = sendEmailVerificationEmail,
  transactionRunner = transaction
}) {
  const input = normalizeRegistrationInput(body);
  const state = verificationState(input.email);
  const credentials = await hashPassword(input.password);
  const ipHash = hashClientIp(ip || "unknown");
  try {
    const result = await transactionRunner(async (client) => {
      await configureIdentityTransaction(client);
      await enforceAccountCreationLimit(client, { ipHash, accountKind: "registered" });
      const current = await lockRegistrationUser(client, actorId);
      if (!current) throwErr("USER_NOT_FOUND");
      if (current.user_kind !== "guest") throwErr("ACCOUNT_ALREADY_REGISTERED");
      const upgraded = await upgradeGuestUser(client, {
        userId: actorId,
        ...input,
        ...credentials,
        emailVerified: state.emailVerified
      });
      if (!upgraded) throwErr("ACCOUNT_ALREADY_REGISTERED");
      await ensureIdentityFoundation(client, {
        userId: actorId,
        planCode: state.internalBeta ? "beta" : "free"
      });
      await applyIdentityPrivileges(client, {
        userId: actorId,
        internalBeta: state.internalBeta
      });
      const user = upgraded;
      const acceptedInvites = user.email_verified_at
        ? await acceptPendingWorldInvitesForVerifiedUser(client, { userId: user.id, email: user.email })
        : [];
      if (state.challenge) {
        await invalidateEmailVerificationTokens(client, actorId);
        await insertEmailVerificationToken(client, {
          userId: actorId,
          tokenHash: state.challenge.tokenHash,
          expiresAt: state.challenge.expiresAt
        });
      }
      await revokeAllIdentitySessions(client, actorId);
      const session = await createSession(actorId, sessionMeta, {
        executor: client.query.bind(client)
      });
      await recordAccountCreation(client, {
        userId: actorId,
        ipHash,
        accountKind: "registered"
      });
      return { user, acceptedInvites, session };
    });
    const verificationEmailSent = await deliverVerificationChallenge({
      user: result.user,
      challenge: state.challenge,
      logger,
      sendVerificationEmail
    });
    return {
      ...result,
      pendingEmailVerification: Boolean(state.challenge),
      verificationEmailSent
    };
  } catch (error) {
    throw normalizeIdentityWriteError(error);
  }
}
