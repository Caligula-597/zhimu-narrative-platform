import { query } from "../db.js";
import {
  createSession,
  createPasswordResetToken,
  createEmailVerificationToken,
  consumePasswordResetToken,
  consumeEmailVerificationToken,
  createGuestUser,
  deleteSession,
  hashPassword,
  listUserSessions,
  revokeAllSessions,
  revokeSessionById,
  sessionRequestMeta,
  updateUserPassword,
  upgradeGuestToRegistered,
  verifyPassword
} from "../auth.js";
import { assertCapability } from "../capabilities.js";
import { acceptWorldMemberInvitesForEmail } from "../world-invites.js";
import { listEnabledOAuthProviders, oauthFrontendReturnUrl } from "../oauth-providers.js";
import { getPublicOAuthDiagnostics } from "../oauth-diagnostics.js";
import {
  buildOAuthAuthorizeUrl,
  completeOAuthLoginCode,
  createOAuthState,
  handleOAuthCallback
} from "../oauth-service.js";
import { fetchUserKind } from "../capabilities.js";
import { sendErr, throwErr } from "../api-errors.js";
import { bearerToken, requireActor } from "../request-actor.js";
import {
  getEmailServiceStatus,
  isEmailConfigured,
  sendEmailVerificationEmail,
  sendPasswordResetEmail
} from "../email.js";
import {
  isEmailVerificationRequired,
  isUserEmailVerified,
  markUserEmailVerified
} from "../email-verification-policy.js";
import { applyInternalBetaPrivileges } from "../internal-accounts.js";
import { ensureUserPlan, initialPlanForEmail, fetchUserPlanCode, planMeta } from "../plans.js";

const forgotPasswordSchema = {
  type: "object",
  additionalProperties: false,
  required: ["email"],
  properties: {
    email: { type: "string", minLength: 3, maxLength: 320 }
  }
};

const resetPasswordSchema = {
  type: "object",
  additionalProperties: false,
  required: ["token", "password"],
  properties: {
    token: { type: "string", minLength: 16, maxLength: 128 },
    password: { type: "string", minLength: 8, maxLength: 128 }
  }
};

const verifyEmailSchema = {
  type: "object",
  additionalProperties: false,
  required: ["token"],
  properties: {
    token: { type: "string", minLength: 16, maxLength: 128 }
  }
};

const PASSWORD_RESET_ACK = {
  ok: true,
  message: "If that email is registered, you will receive a password reset link shortly."
};

const VERIFICATION_RESEND_ACK = {
  ok: true,
  message: "If your account requires verification, a new email has been sent."
};

const authBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["email", "password"],
  properties: {
    email: { type: "string", minLength: 3, maxLength: 320 },
    password: { type: "string", minLength: 8, maxLength: 128 }
  }
};

function userAuthPayload(row) {
  const kind = row.user_kind ?? "registered";
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    userKind: kind,
    isGuest: kind === "guest",
    emailVerified: Boolean(row.email_verified_at)
  };
}

async function ensureStorageQuota(userId) {
  await query(
    `INSERT INTO storage_quotas (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = storage_quotas.updated_at`,
    [userId]
  );
}

async function sendVerificationForUser(userId, email) {
  const { token } = await createEmailVerificationToken(userId);
  await sendEmailVerificationEmail({ to: email, verifyToken: token });
}

export async function registerAuthRoutes(app) {
  app.get("/api/auth/config", async () => ({
    requireEmailVerification: isEmailVerificationRequired(),
    email: getEmailServiceStatus(),
    oauth: listEnabledOAuthProviders(),
    oauthDiagnostics: getPublicOAuthDiagnostics()
  }));

  app.post("/api/auth/register", {
    schema: {
      body: {
        ...authBodySchema,
        required: ["email", "displayName", "password"],
        properties: {
          ...authBodySchema.properties,
          displayName: { type: "string", minLength: 2, maxLength: 40 }
        }
      }
    }
  }, async (request, reply) => {
    const email = request.body.email.trim().toLowerCase();
    const displayName = request.body.displayName.trim();
    const password = request.body.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendErr(reply, "EMAIL_INVALID");
    if (displayName.length < 2) return sendErr(reply, "DISPLAY_NAME_INVALID");

    const verificationRequired = isEmailVerificationRequired();
    if (verificationRequired && !isEmailConfigured()) {
      return sendErr(reply, "EMAIL_NOT_CONFIGURED");
    }

    const { passwordHash, passwordSalt } = await hashPassword(password);
    const created = await query(
      `INSERT INTO users (email, display_name, password_hash, password_salt, email_verified_at)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, email, display_name, email_verified_at`,
      [
        email,
        displayName,
        passwordHash,
        passwordSalt,
        verificationRequired ? null : new Date()
      ]
    ).catch((error) => {
      if (error.code === "23505") throwErr("EMAIL_ALREADY_REGISTERED");
      throw error;
    });

    const user = created.rows[0];
    await ensureUserPlan(user.id, initialPlanForEmail(email));
    await applyInternalBetaPrivileges(user.id, email);
    await ensureStorageQuota(user.id);
    const acceptedInvites = await acceptWorldMemberInvitesForEmail(user.id, email);

    if (verificationRequired) {
      try {
        await sendVerificationForUser(user.id, email);
      } catch (error) {
        request.log.error({ err: error, email }, "verification email failed");
        return sendErr(reply, error.code === "UPSTREAM_ERROR" ? "UPSTREAM_ERROR" : "UNAVAILABLE");
      }
      return reply.code(201).send({
        user: userAuthPayload(user),
        pendingEmailVerification: true,
        acceptedInvites,
        message: "Registration successful. Please verify your email before creating worlds."
      });
    }

    const session = await createSession(user.id, sessionRequestMeta(request));
    return reply.code(201).send({ user: userAuthPayload(user), acceptedInvites, ...session });
  });

  app.post("/api/auth/guest", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          displayName: { type: "string", minLength: 2, maxLength: 40 },
          deviceLabel: { type: "string", minLength: 1, maxLength: 80 }
        }
      }
    }
  }, async (request, reply) => {
    const displayName = request.body?.displayName?.trim();
    const user = await createGuestUser(displayName || null);
    const session = await createSession(user.id, sessionRequestMeta(request));
    return reply.code(201).send({ user: userAuthPayload(user), ...session });
  });

  app.post("/api/auth/upgrade", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["email", "displayName", "password"],
        properties: {
          email: { type: "string", minLength: 3, maxLength: 320 },
          displayName: { type: "string", minLength: 2, maxLength: 40 },
          password: { type: "string", minLength: 8, maxLength: 128 }
        }
      }
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const email = request.body.email.trim().toLowerCase();
    const displayName = request.body.displayName.trim();
    const password = request.body.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendErr(reply, "EMAIL_INVALID");
    if (displayName.length < 2) return sendErr(reply, "DISPLAY_NAME_INVALID");

    const user = await upgradeGuestToRegistered(actorId, { email, displayName, password });
    await ensureUserPlan(user.id, initialPlanForEmail(email));
    await applyInternalBetaPrivileges(user.id, email);
    const acceptedInvites = await acceptWorldMemberInvitesForEmail(user.id, email);
    await revokeAllSessions(actorId);
    const session = await createSession(user.id, sessionRequestMeta(request));
    return reply.code(200).send({
      user: userAuthPayload(user),
      acceptedInvites,
      ...session
    });
  });

  app.post("/api/auth/login", { schema: { body: authBodySchema } }, async (request, reply) => {
    const email = request.body.email.trim().toLowerCase();
    const password = request.body.password;
    const result = await query(
      `SELECT id, email, display_name, password_hash, password_salt, email_verified_at, user_kind
       FROM users WHERE email = $1 AND user_kind = 'registered'`,
      [email]
    );
    if (!result.rowCount || !(await verifyPassword(password, result.rows[0].password_hash, result.rows[0].password_salt))) {
      return sendErr(reply, "INVALID_CREDENTIALS");
    }
    const row = result.rows[0];
    await applyInternalBetaPrivileges(row.id, email);
    const session = await createSession(row.id, sessionRequestMeta(request));
    return {
      user: userAuthPayload(row),
      pendingEmailVerification: isEmailVerificationRequired() && !row.email_verified_at,
      ...session
    };
  });

  app.get("/api/auth/me", async (request) => {
    const actorId = requireActor(request);
    const result = await query(
      `SELECT id, email, display_name, avatar_url, created_at, email_verified_at, user_kind
       FROM users WHERE id = $1`,
      [actorId]
    );
    if (!result.rowCount) throwErr("USER_NOT_FOUND");
    const row = result.rows[0];
    const planCode = await fetchUserPlanCode(actorId);
    const meta = planMeta(planCode);
    return {
      ...row,
      userKind: row.user_kind,
      isGuest: row.user_kind === "guest",
      emailVerified: Boolean(row.email_verified_at),
      planCode,
      planLabel: meta.label,
      planTier: meta.tier,
      isInternalBeta: planCode === "beta"
    };
  });

  app.get("/api/auth/sessions", async (request) => {
    const actorId = requireActor(request);
    await assertCapability(actorId, "account.authenticated");
    const sessions = await listUserSessions(actorId, request.sessionId ?? null);
    return { sessions };
  });

  app.delete("/api/auth/sessions/:sessionId", {
    schema: {
      params: {
        type: "object",
        required: ["sessionId"],
        properties: { sessionId: { type: "string", format: "uuid" } }
      }
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { sessionId } = request.params;
    const ok = await revokeSessionById(actorId, sessionId);
    if (!ok) return sendErr(reply, "SESSION_NOT_FOUND");
    if (sessionId === request.sessionId) {
      await deleteSession(bearerToken(request));
    }
    return reply.code(200).send({ ok: true });
  });

  app.post("/api/auth/logout-all", async (request) => {
    const actorId = requireActor(request);
    const current = request.sessionId ?? null;
    await revokeAllSessions(actorId, current);
    return { ok: true, currentSessionKept: Boolean(current) };
  });

  app.post("/api/auth/logout", async (request) => {
    await deleteSession(bearerToken(request));
    return { ok: true };
  });

  app.post("/api/auth/forgot-password", { schema: { body: forgotPasswordSchema } }, async (request, reply) => {
    if (!isEmailConfigured()) return sendErr(reply, "EMAIL_NOT_CONFIGURED");

    const email = request.body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendErr(reply, "EMAIL_INVALID");

    const result = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (result.rowCount) {
      const { token } = await createPasswordResetToken(result.rows[0].id);
      try {
        await sendPasswordResetEmail({ to: email, resetToken: token });
      } catch (error) {
        request.log.error({ err: error, email }, "password reset email failed");
        return sendErr(reply, error.code === "UPSTREAM_ERROR" ? "UPSTREAM_ERROR" : "UNAVAILABLE");
      }
    }

    return reply.code(200).send(PASSWORD_RESET_ACK);
  });

  app.post("/api/auth/reset-password", { schema: { body: resetPasswordSchema } }, async (request, reply) => {
    const { token, password } = request.body;
    const userId = await consumePasswordResetToken(token.trim());
    if (!userId) return sendErr(reply, "PASSWORD_RESET_INVALID");

    await updateUserPassword(userId, password);
    await revokeAllSessions(userId);
    return reply.code(200).send({ ok: true, message: "Password updated. Please sign in with your new password." });
  });

  app.post("/api/auth/verify-email", { schema: { body: verifyEmailSchema } }, async (request, reply) => {
    const userId = await consumeEmailVerificationToken(request.body.token.trim());
    if (!userId) return sendErr(reply, "EMAIL_VERIFICATION_INVALID");

    await markUserEmailVerified(userId);
    const session = await createSession(userId, sessionRequestMeta(request));
    const user = await query(
      `SELECT id, email, display_name, email_verified_at FROM users WHERE id = $1`,
      [userId]
    );
    return reply.code(200).send({
      ok: true,
      user: userAuthPayload(user.rows[0]),
      ...session
    });
  });

  app.post("/api/auth/resend-verification", async (request, reply) => {
    if (!isEmailVerificationRequired()) {
      return reply.code(200).send({ ok: true, message: "Email verification is not required." });
    }
    if (!isEmailConfigured()) return sendErr(reply, "EMAIL_NOT_CONFIGURED");

    const actorId = requireActor(request);
    if (await isUserEmailVerified(actorId)) {
      return reply.code(200).send({ ok: true, message: "Email is already verified." });
    }

    const result = await query(`SELECT email FROM users WHERE id = $1`, [actorId]);
    if (!result.rowCount) return sendErr(reply, "USER_NOT_FOUND");

    try {
      await sendVerificationForUser(actorId, result.rows[0].email);
    } catch (error) {
      request.log.error({ err: error, userId: actorId }, "resend verification failed");
      return sendErr(reply, error.code === "UPSTREAM_ERROR" ? "UPSTREAM_ERROR" : "UNAVAILABLE");
    }
    return reply.code(200).send(VERIFICATION_RESEND_ACK);
  });

  app.get("/api/auth/oauth/:provider/start", {
    schema: {
      params: {
        type: "object",
        required: ["provider"],
        properties: { provider: { type: "string", enum: ["google", "github"] } }
      }
    }
  }, async (request, reply) => {
    const { provider } = request.params;
    let guestUserId = null;
    if (request.actorId) {
      try {
        if ((await fetchUserKind(request.actorId)) === "guest") guestUserId = request.actorId;
      } catch {
        /* ignore */
      }
    }
    const state = await createOAuthState(provider, guestUserId);
    return reply.redirect(buildOAuthAuthorizeUrl(provider, state));
  });

  app.post("/api/auth/oauth/:provider/start-url", {
    schema: {
      params: {
        type: "object",
        required: ["provider"],
        properties: { provider: { type: "string", enum: ["google", "github"] } }
      }
    }
  }, async (request) => {
    const { provider } = request.params;
    let guestUserId = null;
    if (request.actorId) {
      try {
        if ((await fetchUserKind(request.actorId)) === "guest") guestUserId = request.actorId;
      } catch {
        /* ignore */
      }
    }
    const state = await createOAuthState(provider, guestUserId);
    return { url: buildOAuthAuthorizeUrl(provider, state) };
  });

  app.get("/api/auth/oauth/:provider/callback", {
    schema: {
      params: {
        type: "object",
        required: ["provider"],
        properties: { provider: { type: "string", enum: ["google", "github"] } }
      }
    }
  }, async (request, reply) => {
    const { provider } = request.params;
    const code = String(request.query?.code ?? "");
    const state = String(request.query?.state ?? "");
    const oauthError = String(request.query?.error ?? "");
    const frontend = new URL(oauthFrontendReturnUrl());
    if (oauthError) {
      frontend.searchParams.set("oauth_error", oauthError);
      return reply.redirect(frontend.toString());
    }
    if (!code || !state) return sendErr(reply, "BAD_REQUEST");
    try {
      const redirect = await handleOAuthCallback(provider, { code, state });
      return reply.redirect(redirect);
    } catch (error) {
      request.log.warn({ err: error, provider }, "oauth callback failed");
      frontend.searchParams.set("oauth_error", error.code || "OAUTH_EXCHANGE_FAILED");
      return reply.redirect(frontend.toString());
    }
  });

  app.post("/api/auth/oauth/complete", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["code"],
        properties: { code: { type: "string", minLength: 16, maxLength: 128 } }
      }
    }
  }, async (request, reply) => {
    const result = await completeOAuthLoginCode(request.body.code, sessionRequestMeta(request));
    return reply.code(200).send({
      user: userAuthPayload(result.user),
      token: result.token,
      expiresAt: result.expiresAt,
      sessionId: result.sessionId
    });
  });
}
