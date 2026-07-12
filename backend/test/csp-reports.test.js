import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import {
  normalizeCspReport,
  noteCspViolationForAlert,
  resetCspReportWindowsForTests
} from "../src/csp-reports.js";
import { renderPrometheusMetrics, resetMetricsForTests } from "../src/metrics.js";

test("normalizeCspReport supports legacy envelope and redacts URL secrets", () => {
  const report = normalizeCspReport({
    "csp-report": {
      "document-uri": "https://user:pass@example.com/play?token=secret#role",
      "effective-directive": "require-trusted-types-for",
      "blocked-uri": "https://cdn.example.com/app.js?signature=secret",
      "source-file": "https://example.com/assets/app.js?session=secret",
      "line-number": 42
    }
  });
  assert.equal(report.documentUri, "https://example.com/play");
  assert.equal(report.blockedUri, "https://cdn.example.com/app.js");
  assert.equal(report.sourceFile, "https://example.com/assets/app.js");
  assert.equal(report.violatedDirective, "require-trusted-types-for");
  assert.equal(report.lineNumber, 42);
  assert.doesNotMatch(JSON.stringify(report), /secret|user:pass/);
});

test("normalizeCspReport supports Reporting API body", () => {
  const report = normalizeCspReport([{
    type: "csp-violation",
    body: {
      documentURL: "https://example.com/host?room=private",
      effectiveDirective: "script-src-elem",
      blockedURL: "inline",
      disposition: "report"
    }
  }]);
  assert.equal(report.documentUri, "https://example.com/host");
  assert.equal(report.blockedUri, "inline");
  assert.equal(report.violatedDirective, "script-src-elem");
});

test("CSP alert threshold fires once when the minute threshold is reached", () => {
  const previous = process.env.CSP_ALERT_THRESHOLD_PER_MINUTE;
  process.env.CSP_ALERT_THRESHOLD_PER_MINUTE = "2";
  resetCspReportWindowsForTests();
  try {
    const report = { disposition: "report", violatedDirective: "require-trusted-types-for" };
    assert.equal(noteCspViolationForAlert(report, 60_001).alert, false);
    assert.equal(noteCspViolationForAlert(report, 60_002).alert, true);
    assert.equal(noteCspViolationForAlert(report, 60_003).alert, false);
  } finally {
    if (previous === undefined) delete process.env.CSP_ALERT_THRESHOLD_PER_MINUTE;
    else process.env.CSP_ALERT_THRESHOLD_PER_MINUTE = previous;
  }
});

test("POST /api/csp-report records a low-cardinality Prometheus metric", async (context) => {
  resetMetricsForTests();
  resetCspReportWindowsForTests();
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/csp-report",
    headers: { "content-type": "application/csp-report" },
    payload: {
      "csp-report": {
        "document-uri": "https://example.com/?token=secret",
        "effective-directive": "require-trusted-types-for",
        "blocked-uri": "trusted-types-sink"
      }
    }
  });
  assert.equal(response.statusCode, 204);
  assert.match(
    renderPrometheusMetrics(),
    /csp_violations_total\{disposition="report",directive="require-trusted-types-for"\} 1/
  );
});

test("POST /api/csp-report accepts Reporting API arrays", async (context) => {
  resetMetricsForTests();
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/csp-report",
    headers: { "content-type": "application/reports+json" },
    payload: [{
      type: "csp-violation",
      body: {
        documentURL: "https://example.com/play?invite=secret",
        effectiveDirective: "script-src-elem",
        blockedURL: "inline",
        disposition: "report"
      }
    }]
  });
  assert.equal(response.statusCode, 204);
  assert.match(renderPrometheusMetrics(), /directive="script-src-elem"/);
});
