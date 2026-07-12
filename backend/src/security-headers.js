/**
 * HTTP security headers including Content-Security-Policy (report-only by default in production).
 *
 * Env:
 *   CSP_MODE=off|report-only|enforce  (default: report-only in production, off elsewhere)
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
  return nodeEnv === "production" ? "report-only" : "off";
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
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSrc.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "trusted-types zhimu-html"
  ];

  // A require directive inside a Report-Only header reports violations without
  // blocking them. Enforced CSP keeps Trusted Types behind the explicit gate.
  const requireTrustedTypes = mode === "report-only"
    || String(process.env.TRUSTED_TYPES_ENFORCE || "").toLowerCase() === "true";
  if (requireTrustedTypes) {
    directives.push("require-trusted-types-for 'script'");
  }

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
  const mode = resolveCspMode(nodeEnv ?? process.env.NODE_ENV ?? "development", cspMode);
  const enabled = String(process.env.TRUSTED_TYPES_REPORT_ONLY || "").toLowerCase() === "true";
  const enforced = String(process.env.TRUSTED_TYPES_ENFORCE || "").toLowerCase() === "true";
  if (!enabled || enforced || mode !== "enforce") return null;
  const reportUri = process.env.CSP_REPORT_URI?.trim() || "/api/csp-report";
  return {
    header: "Content-Security-Policy-Report-Only",
    value: `trusted-types zhimu-html; require-trusted-types-for 'script'; report-uri ${reportUri}`
  };
}

export function applySecurityHeaders(reply, { nodeEnv, cspMode } = {}) {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  reply.header("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  if ((nodeEnv ?? process.env.NODE_ENV) === "production") {
    reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  const csp = buildContentSecurityPolicy({ nodeEnv, cspMode });
  if (csp) reply.header(csp.header, csp.value);
  const trustedTypesReportOnly = buildTrustedTypesReportOnlyPolicy({ nodeEnv, cspMode });
  if (trustedTypesReportOnly) reply.header(trustedTypesReportOnly.header, trustedTypesReportOnly.value);
}
