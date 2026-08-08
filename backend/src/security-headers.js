/**
 * HTTP security headers including Content-Security-Policy (report-only by default in production).
 *
 * Env:
 *   CSP_MODE=off|report-only|enforce  (default: enforce in production, off elsewhere)
 *   CSP_REPORT_URI=https://...        optional violation report endpoint
 *   CSP_CONNECT_SRC=...                 extra connect-src origins (space-separated)
 */

const DEFAULT_CONNECT = ["'self'", "wss:", "https:"];

export function resolveCspMode(nodeEnv, override) {
  const raw = override ?? process.env.CSP_MODE ?? "";
  const mode = String(raw).trim().toLowerCase();
  if (mode === "off" || mode === "disable" || mode === "false" || mode === "0") return "off";
  if (mode === "enforce" || mode === "block") return "enforce";
  if (mode === "report-only" || mode === "reportonly") return "report-only";
  return nodeEnv === "production" ? "enforce" : "off";
}

function extraConnectSrc() {
  const raw = process.env.CSP_CONNECT_SRC?.trim();
  if (!raw) return [];
  return raw.split(/\s+/).filter(Boolean);
}

export function buildContentSecurityPolicy({ nodeEnv, cspMode } = {}) {
  const mode = resolveCspMode(nodeEnv ?? process.env.NODE_ENV ?? "development", cspMode);
  if (mode === "off") return null;

  const connectSrc = [...DEFAULT_CONNECT, ...extraConnectSrc()];
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self' https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSrc.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "trusted-types zhimu-html"
  ];

  // All production templates now use the shared zhimu-html policy. Keeping the
  // sink requirement inside both report-only and enforced policies prevents an
  // environment drift from silently disabling the protection.
  directives.push("require-trusted-types-for 'script'");

  const reportUri = process.env.CSP_REPORT_URI?.trim();
  if (reportUri) {
    directives.push(`report-uri ${reportUri}`);
  } else if (mode === "report-only") {
    directives.push("report-uri /api/csp-report");
  }

  const policy = directives.join("; ");
  return mode === "enforce"
    ? { header: "Content-Security-Policy", value: policy }
    : { header: "Content-Security-Policy-Report-Only", value: policy };
}

export function buildTrustedTypesReportOnlyPolicy({ nodeEnv, cspMode } = {}) {
  // Retained as a compatibility export. The primary policy now always carries
  // the Trusted Types requirement, so emitting a second policy could overwrite
  // the complete report-only header in Fastify.
  void nodeEnv;
  void cspMode;
  return null;
}

export function applySecurityHeaders(reply, { nodeEnv, cspMode } = {}) {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  reply.header(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(), payment=(), usb=()"
  );
  if ((nodeEnv ?? process.env.NODE_ENV) === "production") {
    reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  const csp = buildContentSecurityPolicy({ nodeEnv, cspMode });
  if (csp) reply.header(csp.header, csp.value);
  const trustedTypesReportOnly = buildTrustedTypesReportOnlyPolicy({ nodeEnv, cspMode });
  if (trustedTypesReportOnly) reply.header(trustedTypesReportOnly.header, trustedTypesReportOnly.value);
}

function mergeVaryHeader(current, required) {
  const values = new Map();
  const add = (value) => {
    for (const part of String(value || "").split(",")) {
      const normalized = part.trim();
      if (normalized) values.set(normalized.toLowerCase(), normalized);
    }
  };
  if (Array.isArray(current)) current.forEach(add);
  else add(current);
  required.forEach(add);
  return [...values.values()].join(", ");
}

export function isSensitiveApiResponse(request, reply) {
  const pathname = String(request?.url || "").split("?")[0];
  if (pathname === "/metrics") return true;
  if (!pathname.startsWith("/api/")) return false;
  if (
    request?.method === "GET"
    && pathname.startsWith("/api/account/portal-avatars/")
    && reply?.statusCode < 400
  ) return false;
  if (/^\/api\/(?:auth|account|ops|health)(?:\/|$)/u.test(pathname)) return true;
  return Boolean(
    request?.actorId
    || request?.headers?.authorization
    || request?.headers?.cookie
    || reply?.getHeader?.("set-cookie")
  );
}

export function applySensitiveResponseHeaders(request, reply) {
  if (!isSensitiveApiResponse(request, reply)) return;
  reply.header("Cache-Control", "private, no-store, no-transform, max-age=0");
  reply.header("Pragma", "no-cache");
  reply.header("Expires", "0");
  reply.header("Surrogate-Control", "no-store");
  reply.header(
    "Vary",
    mergeVaryHeader(reply.getHeader?.("vary"), ["Origin", "Authorization", "Cookie"])
  );
}
