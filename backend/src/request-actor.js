import { throwErr } from "./api-errors.js";

export function bearerToken(request) {
  const authorization = request.headers.authorization;
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export async function resolveRequestActor(request, { resolveSession, allowDemoUserHeader = false }) {
  const token = bearerToken(request);
  if (token) {
    const ctx = await resolveSession(token);
    const actorId = typeof ctx === "object" && ctx !== null ? ctx.userId : ctx;
    const sessionId = typeof ctx === "object" && ctx !== null ? ctx.sessionId : null;
    if (actorId) {
      request.actorId = actorId;
      request.sessionId = sessionId;
      request.authSource = "session";
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
