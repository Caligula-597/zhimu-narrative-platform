import { throwErr } from "./api-errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function canonicalOrigin(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate || candidate === "null") return "";
  try {
    return new URL(candidate).origin;
  } catch {
    return "";
  }
}

function regexMatches(pattern, origin) {
  pattern.lastIndex = 0;
  const matched = pattern.test(origin);
  pattern.lastIndex = 0;
  return matched;
}

export function isAllowedCookieOrigin(origin, allowedOrigins) {
  const normalized = canonicalOrigin(origin);
  if (!normalized) return false;
  if (allowedOrigins === true) return true;
  if (typeof allowedOrigins === "string") {
    return canonicalOrigin(allowedOrigins) === normalized;
  }
  if (allowedOrigins instanceof RegExp) return regexMatches(allowedOrigins, normalized);
  if (Array.isArray(allowedOrigins)) {
    return allowedOrigins.some((allowed) => (
      allowed instanceof RegExp
        ? regexMatches(allowed, normalized)
        : canonicalOrigin(allowed) === normalized
    ));
  }
  return false;
}

export function assertCookieRequestOrigin(request, allowedOrigins) {
  if (SAFE_METHODS.has(String(request.method || "GET").toUpperCase())) return;
  if (request.authTransport !== "cookie") return;

  const fetchSite = String(request.headers?.["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite === "cross-site") {
    throwErr("CSRF_ORIGIN_FORBIDDEN");
  }

  const origin = request.headers?.origin;
  // Non-browser clients do not consistently send Origin. They cannot borrow a
  // victim browser's ambient HttpOnly cookie, so reject explicit browser
  // cross-site signals and untrusted Origin values instead.
  if (origin != null && origin !== "") {
    if (!isAllowedCookieOrigin(origin, allowedOrigins)) {
      throwErr("CSRF_ORIGIN_FORBIDDEN");
    }
    return;
  }

  const referer = request.headers?.referer;
  if (referer && !isAllowedCookieOrigin(referer, allowedOrigins)) {
    throwErr("CSRF_ORIGIN_FORBIDDEN");
  }
}
