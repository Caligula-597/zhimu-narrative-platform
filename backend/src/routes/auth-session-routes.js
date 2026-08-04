import { sessionRequestMeta } from "../auth.js";
import {
  getIdentityProfile,
  getIdentitySessions,
  loginIdentity,
  logoutIdentityTokens,
  logoutOtherIdentitySessions,
  revokeIdentitySessionById
} from "../auth-session-service.js";
import { bearerToken, requireActor } from "../request-actor.js";
import { clearSessionCookie, readSessionCookie } from "../session-cookie.js";
import { authBodySchema, sendAuthSession, userAuthPayload } from "./auth-route-shared.js";

export async function registerAuthSessionRoutes(app) {
  app.post("/api/auth/login", { schema: { body: authBodySchema } }, async (request, reply) => {
    const result = await loginIdentity({
      email: request.body.email,
      password: request.body.password,
      sessionMeta: sessionRequestMeta(request)
    });
    return sendAuthSession(reply, result.session, {
      user: userAuthPayload(result.user),
      pendingEmailVerification: result.pendingEmailVerification,
      verificationChallenge: result.verificationChallenge
    });
  });

  app.get("/api/auth/me", async (request) => getIdentityProfile(requireActor(request)));

  app.get("/api/auth/sessions", async (request) => ({
    sessions: await getIdentitySessions(requireActor(request), request.sessionId ?? null)
  }));

  app.delete("/api/auth/sessions/:sessionId", {
    schema: {
      params: {
        type: "object", required: ["sessionId"],
        properties: { sessionId: { type: "string", format: "uuid" } }
      }
    }
  }, async (request, reply) => {
    const result = await revokeIdentitySessionById({
      userId: requireActor(request),
      sessionId: request.params.sessionId,
      currentSessionId: request.sessionId ?? null
    });
    if (result.currentSessionRevoked) clearSessionCookie(reply);
    return reply.code(200).send({ ok: true });
  });

  app.post("/api/auth/logout-all", {
    schema: { response: { 200: { type: "object", properties: { ok: { type: "boolean" }, currentSessionKept: { type: "boolean" } } } } }
  }, async (request) => {
    const result = await logoutOtherIdentitySessions(
      requireActor(request),
      request.sessionId ?? null
    );
    return { ok: true, currentSessionKept: result.currentSessionKept };
  });

  app.post("/api/auth/logout", {
    schema: { response: { 200: { type: "object", properties: { ok: { type: "boolean" } } } } }
  }, async (request, reply) => {
    await logoutIdentityTokens([
      bearerToken(request),
      readSessionCookie(request)
    ]);
    clearSessionCookie(reply);
    return { ok: true };
  });
}
