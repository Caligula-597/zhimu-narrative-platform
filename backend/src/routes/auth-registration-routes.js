import { query } from "../db.js";
import {
  createGuestUser, createSession, hashPassword, revokeAllSessions,
  sessionRequestMeta, upgradeGuestToRegistered
} from "../auth.js";
import { acceptWorldMemberInvitesForEmail } from "../world-invites.js";
import { listEnabledOAuthProviders } from "../oauth-providers.js";
import { sendErr, throwErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { getEmailServiceStatus, isEmailConfigured } from "../email.js";
import { isEmailVerificationRequired } from "../email-verification-policy.js";
import { applyInternalBetaPrivileges } from "../internal-accounts.js";
import { applyApprovedBetaApplicationPrivileges } from "../beta-apply.js";
import { assertGuestCreationAllowed, assertRegistrationAllowed } from "../play-social-guard.js";
import { ensureUserPlan, initialPlanForEmail } from "../plans.js";
import {
  authBodySchema, ensureStorageQuota, sendAuthSession,
  sendVerificationForUser, userAuthPayload
} from "./auth-route-shared.js";

export async function registerAuthRegistrationRoutes(app) {
  app.get("/api/auth/config", async () => ({
    requireEmailVerification: isEmailVerificationRequired(),
    email: getEmailServiceStatus(),
    oauth: listEnabledOAuthProviders()
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
    try {
      await assertRegistrationAllowed(request);
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
    const verificationRequired = isEmailVerificationRequired();
    if (verificationRequired && !isEmailConfigured()) return sendErr(reply, "EMAIL_NOT_CONFIGURED");
    const { passwordHash, passwordSalt } = await hashPassword(password);
    const created = await query(
      `INSERT INTO users (email, display_name, password_hash, password_salt, email_verified_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, email, display_name, email_verified_at`,
      [email, displayName, passwordHash, passwordSalt, verificationRequired ? null : new Date()]
    ).catch((error) => {
      if (error.code === "23505") throwErr("EMAIL_ALREADY_REGISTERED");
      throw error;
    });
    const user = created.rows[0];
    await ensureUserPlan(user.id, initialPlanForEmail(email));
    await applyInternalBetaPrivileges(user.id, email);
    await applyApprovedBetaApplicationPrivileges(user.id, email);
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
        user: userAuthPayload(user), pendingEmailVerification: true, acceptedInvites,
        message: "Registration successful. Please verify your email before creating worlds."
      });
    }
    const session = await createSession(user.id, sessionRequestMeta(request));
    return sendAuthSession(reply, session, { user: userAuthPayload(user), acceptedInvites }, 201);
  });

  app.post("/api/auth/guest", {
    schema: {
      body: {
        type: "object", additionalProperties: false,
        properties: {
          displayName: { type: "string", minLength: 2, maxLength: 40 },
          deviceLabel: { type: "string", minLength: 1, maxLength: 80 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await assertGuestCreationAllowed(request);
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
    const user = await createGuestUser(request.body?.displayName?.trim() || null);
    const session = await createSession(user.id, sessionRequestMeta(request));
    return sendAuthSession(reply, session, { user: userAuthPayload(user) }, 201);
  });

  app.post("/api/auth/upgrade", {
    schema: {
      body: {
        type: "object", additionalProperties: false,
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
    await applyApprovedBetaApplicationPrivileges(user.id, email);
    const acceptedInvites = await acceptWorldMemberInvitesForEmail(user.id, email);
    await revokeAllSessions(actorId);
    const session = await createSession(user.id, sessionRequestMeta(request));
    return sendAuthSession(reply, session, { user: userAuthPayload(user), acceptedInvites }, 200);
  });
}
