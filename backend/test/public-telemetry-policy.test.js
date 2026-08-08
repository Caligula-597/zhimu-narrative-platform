import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCspReport } from "../src/csp-reports.js";
import { recordWebVital, renderPrometheusMetrics, resetMetricsForTests } from "../src/metrics.js";

test("CSP metric dimensions and numeric fields have bounded cardinality", () => {
  const report = normalizeCspReport({
    "csp-report": {
      "effective-directive": "attacker-created-directive",
      disposition: "attacker-created-disposition",
      "status-code": "999999999999999999999",
      "line-number": -42,
      "column-number": "Infinity"
    }
  });
  assert.deepEqual(
    {
      directive: report.violatedDirective,
      disposition: report.disposition,
      statusCode: report.statusCode,
      lineNumber: report.lineNumber,
      columnNumber: report.columnNumber
    },
    { directive: "other", disposition: "other", statusCode: 0, lineNumber: 0, columnNumber: 0 }
  );
});

test("invalid public Web Vitals cannot poison metric values or labels", () => {
  resetMetricsForTests();
  recordWebVital({ name: "LCP", app: "app", rating: "good", value: 1200 });
  recordWebVital({ name: "LCP", app: "attacker-app", rating: "good", value: 1 });
  recordWebVital({ name: "LCP", app: "app", rating: "attacker-rating", value: 1 });
  recordWebVital({ name: "LCP", app: "app", rating: "poor", value: Number.MAX_VALUE });
  recordWebVital({ name: "CLS", app: "app", rating: "poor", value: 100 });

  const output = renderPrometheusMetrics({});
  assert.match(output, /web_vital_value_count\{app="app",name="LCP"\} 1/u);
  assert.match(output, /web_vital_value_sum\{app="app",name="LCP"\} 1200/u);
  assert.doesNotMatch(output, /attacker-app|attacker-rating|1\.7976931348623157e\+308/u);
  assert.doesNotMatch(output, /web_vital_value_count\{app="app",name="CLS"\}/u);
});
