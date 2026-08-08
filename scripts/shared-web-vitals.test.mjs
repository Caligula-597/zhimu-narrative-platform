import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_WEB_VITAL_APP,
  rateWebVital,
  reportWebVital,
  WEB_VITAL_APPS,
  WEB_VITAL_NAMES,
  WEB_VITAL_RATINGS,
  WEB_VITAL_THRESHOLDS
} from "../shared/web-vitals.js";

test("rateWebVital uses CWV thresholds", () => {
  assert.equal(rateWebVital("LCP", 2000), "good");
  assert.equal(rateWebVital("LCP", 3000), "needs-improvement");
  assert.equal(rateWebVital("LCP", 5000), "poor");
  assert.equal(rateWebVital("CLS", 0.05), "good");
  assert.equal(rateWebVital("INP", 400), "needs-improvement");
  assert.equal(rateWebVital("UNKNOWN", 1), "unknown");
});

test("reportWebVital fills rating and invokes onMetric", () => {
  const seen = [];
  reportWebVital({ name: "LCP", value: 1200, id: "lcp-1" }, {
    onMetric: (metric) => seen.push(metric)
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].name, "LCP");
  assert.equal(seen[0].rating, "good");
  assert.equal(seen[0].value, 1200);
});

test("WEB_VITAL_THRESHOLDS covers core metrics", () => {
  for (const name of WEB_VITAL_NAMES) {
    assert.ok(WEB_VITAL_THRESHOLDS[name]?.good != null);
  }
});

test("public telemetry contract includes the Guardian fallback app", () => {
  assert.equal(DEFAULT_WEB_VITAL_APP, "unknown");
  assert.ok(WEB_VITAL_APPS.includes(DEFAULT_WEB_VITAL_APP));
  assert.deepEqual(WEB_VITAL_RATINGS, ["good", "needs-improvement", "poor", "unknown"]);
});
