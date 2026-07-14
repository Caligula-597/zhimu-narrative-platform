import { query } from "../db.js";
import {
  createSession, deleteSession, listUserSessions, revokeAllSessions,
  revokeSessionById, sessionRequestMeta, verifyPassword
} from "../auth.js";
import { assertCapability } from "../capabilities.js";
import { sendErr, throwErr } from "../api-errors.js";
import { bearerToken, requireActor } from "../request-actor.js";
import { clearSessionCookie, readSessionCookie } from "../session-cookie.js";
import { applyInternalBetaPrivileges } from "../internal-accounts.js";
import { applyApprovedBetaApplicationPrivileges } from "../beta-apply.js";
import { fetchUserPlanCode, planMeta } from "../plans.js";
import { isEmailVerificationRequired } from "../email-verification-policy.js";
import { authBodySchema, sendAuthSession, userAuthPayload } from "./auth-route-shared.js";

export async function registerAuthSessionRoutes(app) {
  app.post("/api/auth/login", { schema: { body: authBodySchema } }, async (request, reply) => {
    const email = request.body.email.trim().toLowerCase();
    const result = await query(
      `SELECT id, email, display_name, password_hash, password_salt, email_verified_at, user_kind
       FROM users WHERE email = $1 AND user_kind = 'registered'`, [email]
    );
    if (!result.rowCount || !(await verifyPassword(request.body.password, result.rows[0].password_hash, result.rows[0].password_salt))) {
      return sendErr(reply, "INVALID_CREDENTIALS");
    }
    const row = result.rows[0];
    await applyInternalBetaPrivileges(row.id, email);
    await applyApprovedBetaApplicationPrivileges(row.id, email);
    const session = await createSession(row.id, sessionRequestMeta(request));
    return sendAuthSession(reply, session, {
      user: userAuthPayload(row),
      pendingEmailVerification: isEmailVerificationRequired() && !row.email_verified_at
    });
  });

  app.get("/api/auth/me", async (request) => {
    const actorId = requireActor(request);
    const result = await query(
      `SELECT id, email, display_name, avatar_url, created_at, email_verified_at, user_kind FROM users WHERE id = $1`,
      [actorId]
    );
    if (!result.rowCount) throwErr("USER_NOT_FOUND");
    const row = result.rows[0];
    const planCode = await fetchUserPlanCode(actorId);
    const meta = planMeta(planCode);
    return {
      ...row, userKind: row.user_kind, isGuest: row.user_kind === "guest",
      emailVerified: Boolean(row.email_verified_at), planCode, planLabel: meta.label,
      planTier: meta.tier, isInternalBeta: planCode === "beta"
    };
  });

  app.get("/api/auth/sessions", async (request) => {
    const actorId = requireActor(request);
    await assertCapability(actorId, "account.authenticated");
    return { sessions: await listUserSessions(actorId, request.sessionId ?? null) };
  });

  app.delete("/api/auth/sessions/:sessionId", {
    schema: {
      params: {
        type: "object", required: ["sessionId"],
        properties: { sessionId: { type: "string", format: "uuid" } }
      }
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { sessionId } = request.params;
    if (!(await revokeSessionById(actorId, sessionId))) return sendErr(reply, "SESSION_NOT_FOUND");
    if (sessionId === request.sessionId) {
      await deleteSession(bearerToken(request) || readSessionCookie(request));
      clearSessionCookie(reply);
    }
    return reply.code(200).send({ ok: true });
  });

  app.post("/api/auth/logout-all", {
    schema: { response: { 200: { type: "object", properties: { ok: { type: "boolean" }, currentSessionKept: { type: "boolean" } } } } }
  }, async (request) => {
    const actorId = requireActor(request);
    const current = request.sessionId ?? null;
    await revokeAllSessions(actorId, current);
    return { ok: true, currentSessionKept: Boolean(current) };
  });

  app.post("/api/auth/logout", {
    schema: { response: { 200: { type: "object", properties: { ok: { type: "boolean" } } } } }
  }, async (request, reply) => {
    const tokens = new Set([bearerToken(request), readSessionCookie(request)].filter(Boolean));
    await Promise.all([...tokens].map((token) => deleteSession(token)));
    clearSessionCookie(reply);
    return { ok: true };
  });
}
