import assert from "node:assert/strict";
import test from "node:test";
import { recordWebVital, renderPrometheusMetrics, resetMetricsForTests } from "../src/metrics.js";

test("recordWebVital stores rating counts and value histogram", () => {
  resetMetricsForTests();
  recordWebVital({ name: "LCP", app: "app", rating: "good", value: 1200 });
  recordWebVital({ name: "LCP", app: "app", rating: "poor", value: 5000 });
  const text = renderPrometheusMetrics({});
  assert.match(text, /web_vitals_total\{app="app",name="LCP",rating="good"\} 1/);
  assert.match(text, /web_vitals_total\{app="app",name="LCP",rating="poor"\} 1/);
  assert.match(text, /web_vital_value_count\{app="app",name="LCP"\} 2/);
  assert.match(text, /web_vital_value_sum\{app="app",name="LCP"\} 6200/);
  assert.match(text, /web_vital_value_bucket\{app="app",name="LCP",le="2500"\} 1/);
});
