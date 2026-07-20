import { createSession, hashPassword } from "./auth.js";
import { createAuthToken, hashAuthToken } from "./auth-token.js";
import { httpError, throwErr } from "./api-errors.js";
import { transaction } from "./db.js";
import {
  isEmailConfigured,
  sendEmailVerificationEmail,
  sendPasswordResetEmail
} from "./email.js";
import { isEmailVerificationRequired } from "./email-verification-policy.js";
import {
  configureAuthRecoveryTransaction,
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  findEmailVerificationUserId,
  findPasswordResetUserId,
  insertEmailVerificationToken,
  insertPasswordResetToken,
  invalidateEmailVerificationTokens,
  invalidatePasswordResetTokens,
  lockRecoveryUserById,
  lockRegisteredUserByEmail,
  markRecoveryUserEmailVerified,
  updatePasswordAndRevokeSessions
} from "./repositories/auth-recovery-repository.js";
import { acceptPendingWorldInvitesForVerifiedUser } from "./repositories/auth-identity-repository.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_INSERT_ATTEMPTS = 2;

function isTokenHashCollision(error) {
  return error?.code === "23505" && [
    "password_reset_tokens_token_hash_key",
    "email_verification_tokens_token_hash_key"
  ].includes(error?.constraint);
}

export function normalizeAuthRecoveryError(error) {
  if (["40P01", "55P03"].includes(error?.code)) {
    return httpError(409, "Authentication recovery is busy; retry shortly", "AUTH_RECOVERY_WRITE_BUSY");
  }
  if (error?.code === "57014") {
    return httpError(503, "Authentication recovery exceeded its safe execution window", "AUTH_RECOVERY_WRITE_TIMEOUT");
  }
  return error;
}

function normalizeEmail(email) {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) throwErr("EMAIL_INVALID");
  return normalized;
}

async function createPasswordResetChallenge(email, transactionRunner = transaction) {
  for (let attempt = 1; attempt <= TOKEN_INSERT_ATTEMPTS; attempt += 1) {
    const token = createAuthToken();
    const tokenHash = hashAuthToken(token);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    try {
      const user = await transactionRunner(async (client) => {
        await configureAuthRecoveryTransaction(client);
        const locked = await lockRegisteredUserByEmail(client, email);
        if (!locked) return null;
        await invalidatePasswordResetTokens(client, locked.id);
        await insertPasswordResetToken(client, { userId: locked.id, tokenHash, expiresAt });
        return locked;
      });
      return user ? { user, token, tokenHash, expiresAt } : null;
    } catch (error) {
      if (isTokenHashCollision(error)) {
        if (attempt < TOKEN_INSERT_ATTEMPTS) continue;
        throwErr("AUTH_RECOVERY_TOKEN_UNAVAILABLE");
      }
      throw normalizeAuthRecoveryError(error);
    }
  }
  throw new Error("Unable to allocate password reset token");
}

async function createEmailVerificationChallenge({
  userId,
  skipIfVerified = false,
  transactionRunner = transaction
}) {
  for (let attempt = 1; attempt <= TOKEN_INSERT_ATTEMPTS; attempt += 1) {
    const token = createAuthToken();
    const tokenHash = hashAuthToken(token);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    try {
      const user = await transactionRunner(async (client) => {
        await configureAuthRecoveryTransaction(client);
        const locked = await lockRecoveryUserById(client, userId);
        if (!locked) throwErr("USER_NOT_FOUND");
        if (skipIfVerified && locked.email_verified_at) return { alreadyVerified: true, user: locked };
        await invalidateEmailVerificationTokens(client, userId);
        await insertEmailVerificationToken(client, { userId, tokenHash, expiresAt });
        return { alreadyVerified: false, user: locked };
      });
      return user.alreadyVerified
        ? user
        : { ...user, token, tokenHash, expiresAt };
    } catch (error) {
      if (isTokenHashCollision(error)) {
        if (attempt < TOKEN_INSERT_ATTEMPTS) continue;
        throwErr("AUTH_RECOVERY_TOKEN_UNAVAILABLE");
      }
      throw normalizeAuthRecoveryError(error);
    }
  }
  throw new Error("Unable to allocate email verification token");
}

export async function requestPasswordReset({
  email,
  logger,
  sendEmail = sendPasswordResetEmail,
  transactionRunner = transaction
}) {
  if (!isEmailConfigured()) throwErr("EMAIL_NOT_CONFIGURED");
  const normalizedEmail = normalizeEmail(email);
  const challenge = await createPasswordResetChallenge(normalizedEmail, transactionRunner);
  if (!challenge) return { delivered: false };
  try {
    await sendEmail({ to: challenge.user.email, resetToken: challenge.token });
    return { delivered: true };
  } catch (error) {
    logger?.error?.({ err: error }, "password reset email failed");
    // Do not expose provider failures only for registered accounts. The public
    // acknowledgement must remain indistinguishable from an unknown email.
    // Keep the token because an upstream timeout can happen after acceptance.
    return { delivered: false };
  }
}

export async function resetPassword({ token, password, transactionRunner = transaction }) {
  const tokenHash = hashAuthToken(String(token ?? "").trim());
  // Scrypt is deliberately completed before opening a database transaction.
  const credentials = await hashPassword(password);
  try {
    return await transactionRunner(async (client) => {
      await configureAuthRecoveryTransaction(client);
      const candidateUserId = await findPasswordResetUserId(client, tokenHash);
      if (!candidateUserId) throwErr("PASSWORD_RESET_INVALID");
      const user = await lockRecoveryUserById(client, candidateUserId);
      if (!user) throwErr("PASSWORD_RESET_INVALID");
      const consumedUserId = await consumePasswordResetToken(client, tokenHash);
      if (consumedUserId !== user.id) throwErr("PASSWORD_RESET_INVALID");
      if (!(await updatePasswordAndRevokeSessions(client, { userId: user.id, ...credentials }))) {
        throwErr("PASSWORD_RESET_INVALID");
      }
      return { userId: user.id };
    });
  } catch (error) {
    throw normalizeAuthRecoveryError(error);
  }
}

export async function verifyEmail({
  token,
  sessionMeta,
  transactionRunner = transaction
}) {
  const tokenHash = hashAuthToken(String(token ?? "").trim());
  try {
    return await transactionRunner(async (client) => {
      await configureAuthRecoveryTransaction(client);
      const candidateUserId = await findEmailVerificationUserId(client, tokenHash);
      if (!candidateUserId) throwErr("EMAIL_VERIFICATION_INVALID");
      const user = await lockRecoveryUserById(client, candidateUserId);
      if (!user) throwErr("EMAIL_VERIFICATION_INVALID");
      const consumedUserId = await consumeEmailVerificationToken(client, tokenHash);
      if (consumedUserId !== user.id) throwErr("EMAIL_VERIFICATION_INVALID");
      const verifiedUser = await markRecoveryUserEmailVerified(client, user.id);
      const acceptedInvites = await acceptPendingWorldInvitesForVerifiedUser(client, {
        userId: verifiedUser.id,
        email: verifiedUser.email
      });
      const session = await createSession(user.id, sessionMeta, {
        executor: client.query.bind(client)
      });
      return { user: verifiedUser, session, acceptedInvites };
    });
  } catch (error) {
    throw normalizeAuthRecoveryError(error);
  }
}

export async function sendVerificationForUser(userId, _email, {
  logger,
  sendEmail = sendEmailVerificationEmail,
  skipIfVerified = false,
  transactionRunner = transaction
} = {}) {
  const challenge = await createEmailVerificationChallenge({
    userId,
    skipIfVerified,
    transactionRunner
  });
  if (challenge.alreadyVerified) return { alreadyVerified: true };
  try {
    await sendEmail({ to: challenge.user.email, verifyToken: challenge.token });
    return { alreadyVerified: false };
  } catch (error) {
    logger?.error?.({ err: error, userId }, "email verification delivery failed");
    throw error;
  }
}

export async function resendEmailVerification({ userId, logger }) {
  if (!isEmailVerificationRequired()) return { verificationRequired: false };
  if (!isEmailConfigured()) throwErr("EMAIL_NOT_CONFIGURED");
  const result = await sendVerificationForUser(userId, null, {
    logger,
    skipIfVerified: true
  });
  return { verificationRequired: true, alreadyVerified: result.alreadyVerified };
}
