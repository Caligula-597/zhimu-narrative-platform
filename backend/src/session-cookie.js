const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME?.trim() || "zhimu_session";

function parseCookieHeader(header) {
  if (!header || typeof header !== "string") return {};
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function resolveNodeEnv() {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

function cookieSecure(nodeEnv = resolveNodeEnv()) {
  return nodeEnv === "production" || process.env.SESSION_COOKIE_SECURE === "true";
}

export function readSessionCookie(request) {
  const cookies = parseCookieHeader(request.headers.cookie);
  const value = cookies[SESSION_COOKIE];
  return typeof value === "string" && value.length >= 16 ? value : "";
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
