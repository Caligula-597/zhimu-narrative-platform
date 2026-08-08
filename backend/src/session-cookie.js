const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME?.trim() || "zhimu_session";

function parseCookieHeader(header) {
  if (!header || typeof header !== "string") return {};
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      // A malformed percent-escape is attacker input, not a server failure.
      // Ignore that cookie instead of turning it into a noisy 500 response.
    }
  }
  return out;
}

function resolveNodeEnv() {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function cookieSecure(nodeEnv = resolveNodeEnv(), env = process.env) {
  return nodeEnv === "production" || env.SESSION_COOKIE_SECURE === "true";
}

export function sessionBearerResponseEnabled(nodeEnv = resolveNodeEnv(), env = process.env) {
  const configured = String(env.SESSION_BEARER_RESPONSE_ENABLED ?? "").trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return nodeEnv !== "production";
}

export function sessionResponsePayload(session, nodeEnv = resolveNodeEnv(), env = process.env) {
  if (!session || typeof session !== "object") return {};
  if (sessionBearerResponseEnabled(nodeEnv, env)) return { ...session };
  const { token: _token, ...safeSession } = session;
  return safeSession;
}

export function getSessionCookieSecurityStatus(env = process.env) {
  const nodeEnv = env.NODE_ENV === "production" ? "production" : "development";
  return {
    secure: cookieSecure(nodeEnv, env),
    httpOnly: true,
    sameSite: "Lax",
    bearerResponseEnabled: sessionBearerResponseEnabled(nodeEnv, env),
    revocationTable: "auth_sessions"
  };
}

export function readSessionCookie(request) {
  const cookies = parseCookieHeader(request.headers.cookie);
  const value = cookies[SESSION_COOKIE];
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,128}$/u.test(value) ? value : "";
}

export function setSessionCookie(reply, token, expiresAt, nodeEnv = resolveNodeEnv()) {
  if (!token) return;
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (cookieSecure(nodeEnv)) parts.push("Secure");
  if (expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime())) {
    parts.push(`Expires=${expiresAt.toUTCString()}`);
  }
  reply.header("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(reply, nodeEnv = resolveNodeEnv()) {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];
  if (cookieSecure(nodeEnv)) parts.push("Secure");
  reply.header("Set-Cookie", parts.join("; "));
}

export function attachSessionToReply(reply, session, nodeEnv = resolveNodeEnv()) {
  if (!session?.token) return;
  setSessionCookie(reply, session.token, session.expiresAt ? new Date(session.expiresAt) : null, nodeEnv);
}

export { SESSION_COOKIE };
