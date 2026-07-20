import { sessionRequestMeta } from "../auth.js";
import {
  requestPasswordReset,
  resendEmailVerification,
  resetPassword,
  verifyEmail
} from "../auth-recovery-service.js";
import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import {
  forgotPasswordSchema, PASSWORD_RESET_ACK, resetPasswordSchema, sendAuthSession,
  userAuthPayload,
  VERIFICATION_RESEND_ACK, verifyEmailSchema
} from "./auth-route-shared.js";

export async function registerAuthRecoveryRoutes(app) {
  app.post("/api/auth/forgot-password", { schema: { body: forgotPasswordSchema } }, async (request, reply) => {
    await requestPasswordReset({ email: request.body.email, logger: request.log });
    return reply.code(200).send(PASSWORD_RESET_ACK);
  });

  app.post("/api/auth/reset-password", { schema: { body: resetPasswordSchema } }, async (request, reply) => {
    await resetPassword(request.body);
    return reply.code(200).send({ ok: true, message: "Password updated. Please sign in with your new password." });
  });

  app.post("/api/auth/verify-email", { schema: { body: verifyEmailSchema } }, async (request, reply) => {
    const { session, user, acceptedInvites } = await verifyEmail({
      token: request.body.token,
      sessionMeta: sessionRequestMeta(request)
    });
    return sendAuthSession(reply, session, {
      ok: true,
      user: userAuthPayload(user),
      acceptedInvites
    }, 200);
  });

  app.post("/api/auth/resend-verification", {
    schema: { response: { 200: { type: "object", additionalProperties: true } } }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    try {
      const result = await resendEmailVerification({ userId: actorId, logger: request.log });
      if (!result.verificationRequired) {
        return reply.code(200).send({ ok: true, message: "Email verification is not required." });
      }
      if (result.alreadyVerified) {
        return reply.code(200).send({ ok: true, message: "Email is already verified." });
      }
    } catch (error) {
      request.log.error({ err: error, userId: actorId }, "resend verification failed");
      if (error.code === "EMAIL_NOT_CONFIGURED" || error.code === "USER_NOT_FOUND") {
        return sendErr(reply, error.code);
      }
      if (error.statusCode && !["UPSTREAM_ERROR", "UNAVAILABLE"].includes(error.code)) throw error;
      return sendErr(reply, error.code === "UPSTREAM_ERROR" ? "UPSTREAM_ERROR" : "UNAVAILABLE");
    }
    return reply.code(200).send(VERIFICATION_RESEND_ACK);
  });
}
