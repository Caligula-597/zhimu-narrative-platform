const reportWindows = new Map();
const clientWindows = new Map();

const ALLOWED_DIRECTIVES = new Set([
  "base-uri",
  "child-src",
  "connect-src",
  "default-src",
  "font-src",
  "form-action",
  "frame-ancestors",
  "frame-src",
  "img-src",
  "manifest-src",
  "media-src",
  "navigate-to",
  "object-src",
  "prefetch-src",
  "require-trusted-types-for",
  "script-src",
  "script-src-attr",
  "script-src-elem",
  "style-src",
  "style-src-attr",
  "style-src-elem",
  "trusted-types",
  "worker-src"
]);

const MAX_REPORT_WINDOWS = 256;
const MAX_CLIENT_WINDOWS = 2000;

function text(value, max = 160) {
  return String(value ?? "").replace(/[\r\n\t]/g, " ").trim().slice(0, max);
}

function safeUrl(value) {
  const raw = text(value, 1000);
  if (!raw) return "";
  if (["inline", "eval", "self", "none"].includes(raw)) return raw;
  try {
    const url = new URL(raw, "https://redacted.invalid");
    if (url.origin === "https://redacted.invalid") return text(url.pathname, 300);
    return text(`${url.protocol}//${url.host}${url.pathname}`, 500);
  } catch {
    return "invalid-url";
  }
}

function normalizeDirective(value) {
  const raw = text(value, 120).toLowerCase();
  if (!raw) return "unknown";
  // Browsers may send "script-src-elem 'unsafe-inline'" — take the first token.
  const directive = raw.split(/\s+/)[0];
  return ALLOWED_DIRECTIVES.has(directive) ? directive : "other";
}

function pruneMap(map, windowStart, maxSize) {
  for (const [key, entry] of map) {
    if (entry.windowStart !== windowStart) map.delete(key);
  }
  if (map.size <= maxSize) return;
  const overflow = map.size - maxSize;
  let removed = 0;
  for (const key of map.keys()) {
    map.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

export function normalizeCspReport(payload = {}) {
  const envelope = Array.isArray(payload) ? payload[0] ?? {} : payload;
  const report = envelope["csp-report"] ?? envelope.body ?? envelope;
  const directive = normalizeDirective(
    report["effective-directive"] ?? report.effectiveDirective
      ?? report["violated-directive"] ?? report.violatedDirective
  );
  return {
    documentUri: safeUrl(report["document-uri"] ?? report.documentURL ?? report.documentURI),
    violatedDirective: directive,
    blockedUri: safeUrl(report["blocked-uri"] ?? report.blockedURL ?? report.blockedURI),
    sourceFile: safeUrl(report["source-file"] ?? report.sourceFile),
    disposition: text(report.disposition, 20) || "report",
    statusCode: Number(report["status-code"] ?? report.statusCode) || 0,
    lineNumber: Number(report["line-number"] ?? report.lineNumber) || 0,
    columnNumber: Number(report["column-number"] ?? report.columnNumber) || 0
  };
}

export function noteCspViolationForAlert(report, now = Date.now()) {
  const threshold = Math.max(1, Number(process.env.CSP_ALERT_THRESHOLD_PER_MINUTE) || 20);
  const key = `${report.disposition}:${report.violatedDirective}`;
  const windowStart = now - (now % 60_000);
  pruneMap(reportWindows, windowStart, MAX_REPORT_WINDOWS);
  const previous = reportWindows.get(key);
  const count = previous?.windowStart === windowStart ? previous.count + 1 : 1;
  reportWindows.set(key, { windowStart, count });
  return { count, threshold, alert: count === threshold };
}

/**
 * Per-client soft rate limit for unauthenticated CSP endpoints.
 * Over-limit reports should still return 204 but skip metrics/logging.
 */
export function allowCspReportFromClient(clientKey, now = Date.now()) {
  const limit = Math.max(1, Number(process.env.CSP_REPORT_RATE_LIMIT_PER_MINUTE) || 60);
  const key = text(clientKey, 120) || "unknown";
  const windowStart = now - (now % 60_000);
  pruneMap(clientWindows, windowStart, MAX_CLIENT_WINDOWS);
  const previous = clientWindows.get(key);
  const count = previous?.windowStart === windowStart ? previous.count + 1 : 1;
  clientWindows.set(key, { windowStart, count });
  return count <= limit;
}

export function resetCspReportWindowsForTests() {
  reportWindows.clear();
  clientWindows.clear();
}
