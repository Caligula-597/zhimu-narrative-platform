const reportWindows = new Map();

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

export function normalizeCspReport(payload = {}) {
  const envelope = Array.isArray(payload) ? payload[0] ?? {} : payload;
  const report = envelope["csp-report"] ?? envelope.body ?? envelope;
  const directive = text(
    report["effective-directive"] ?? report.effectiveDirective
      ?? report["violated-directive"] ?? report.violatedDirective,
    120
  ) || "unknown";
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
  const previous = reportWindows.get(key);
  const count = previous?.windowStart === windowStart ? previous.count + 1 : 1;
  reportWindows.set(key, { windowStart, count });
  return { count, threshold, alert: count === threshold };
}

export function resetCspReportWindowsForTests() {
  reportWindows.clear();
}
