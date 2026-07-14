import { query } from "../db.js";
import {
  consumeEmailVerificationToken, consumePasswordResetToken, createPasswordResetToken,
  createSession, revokeAllSessions, sessionRequestMeta, updateUserPassword
} from "../auth.js";
import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { isEmailConfigured, sendPasswordResetEmail } from "../email.js";
import {
  isEmailVerificationRequired, isUserEmailVerified, markUserEmailVerified
} from "../email-verification-policy.js";
import {
  forgotPasswordSchema, PASSWORD_RESET_ACK, resetPasswordSchema, sendAuthSession,
  sendVerificationForUser, userAuthPayload,
  VERIFICATION_RESEND_ACK, verifyEmailSchema
} from "./auth-route-shared.js";

export async function registerAuthRecoveryRoutes(app) {
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
    const user = await query(`SELECT id, email, display_name, email_verified_at, user_kind FROM users WHERE id = $1`, [userId]);
    return sendAuthSession(reply, session, { ok: true, user: userAuthPayload(user.rows[0]) }, 200);
  });

  app.post("/api/auth/resend-verification", {
    schema: { response: { 200: { type: "object", additionalProperties: true } } }
  }, async (request, reply) => {
    if (!isEmailVerificationRequired()) return reply.code(200).send({ ok: true, message: "Email verification is not required." });
    if (!isEmailConfigured()) return sendErr(reply, "EMAIL_NOT_CONFIGURED");
    const actorId = requireActor(request);
    if (await isUserEmailVerified(actorId)) return reply.code(200).send({ ok: true, message: "Email is already verified." });
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
}
