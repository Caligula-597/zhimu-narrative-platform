import { throwErr } from "./api-errors.js";
import { readSessionCookie } from "./session-cookie.js";

export function bearerToken(request) {
  const authorization = String(request.headers.authorization || "");
  const match = authorization.match(/^Bearer ([A-Za-z0-9_-]{16,128})$/iu);
  return match?.[1] || "";
}

export function resolveSessionToken(request) {
  const bearer = bearerToken(request);
  if (bearer) return bearer;
  return readSessionCookie(request);
}

export async function resolveRequestActor(request, { resolveSession, allowDemoUserHeader = false }) {
  const bearer = bearerToken(request);
  const cookie = readSessionCookie(request);
  const candidates = [
    bearer ? { token: bearer, transport: "bearer" } : null,
    cookie && cookie !== bearer ? { token: cookie, transport: "cookie" } : null
  ].filter(Boolean);

  request.authTransport = null;
  for (const candidate of candidates) {
    const ctx = await resolveSession(candidate.token);
    const actorId = typeof ctx === "object" && ctx !== null ? ctx.userId : ctx;
    const sessionId = typeof ctx === "object" && ctx !== null ? ctx.sessionId : null;
    if (actorId) {
      request.actorId = actorId;
      request.sessionId = sessionId;
      request.authSource = "session";
      request.authTransport = candidate.transport;
      return actorId;
    }
  }

  if (allowDemoUserHeader && request.headers["x-user-id"]) {
    request.actorId = String(request.headers["x-user-id"]);
    request.authSource = "demo-header";
    return request.actorId;
  }

  return null;
}

export function requireActor(request) {
  if (!request.actorId) {
    throwErr("AUTH_REQUIRED");
  }
  return request.actorId;
}
