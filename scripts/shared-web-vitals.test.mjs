import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_WEB_VITAL_APP,
  initWebVitalsReporting,
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

test("browser observers flush one summary per metric instead of one beacon per interaction", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalObserver = globalThis.PerformanceObserver;
  const observers = [];
  const listeners = new Map();

  class FakePerformanceObserver {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }

    observe(options) {
      this.type = options.type;
    }

    disconnect() {}
  }

  globalThis.window = {
    addEventListener: (type, listener) => listeners.set(`window:${type}`, listener),
    removeEventListener: (type) => listeners.delete(`window:${type}`)
  };
  globalThis.document = {
    visibilityState: "visible",
    addEventListener: (type, listener) => listeners.set(`document:${type}`, listener),
    removeEventListener: (type) => listeners.delete(`document:${type}`)
  };
  globalThis.PerformanceObserver = FakePerformanceObserver;

  try {
    const metrics = [];
    const dispose = initWebVitalsReporting({ onMetric: (metric) => metrics.push(metric) });
    const observer = (type) => observers.find((item) => item.type === type);
    observer("largest-contentful-paint").callback({
      getEntries: () => [{ startTime: 900 }, { startTime: 1250 }]
    });
    observer("layout-shift").callback({
      getEntries: () => [{ value: 0.04, hadRecentInput: false }, { value: 0.5, hadRecentInput: true }]
    });
    observer("event").callback({
      getEntries: () => [
        { duration: 60, interactionId: 1 },
        { duration: 140, interactionId: 2 },
        { duration: 80, interactionId: 3 }
      ]
    });

    assert.equal(metrics.length, 0);
    dispose();
    assert.deepEqual(metrics.map((metric) => metric.name), ["LCP", "CLS", "INP"]);
    assert.equal(metrics.find((metric) => metric.name === "LCP").value, 1250);
    assert.equal(metrics.find((metric) => metric.name === "CLS").value, 0.04);
    assert.equal(metrics.find((metric) => metric.name === "INP").value, 140);
    assert.equal(listeners.size, 0);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalObserver === undefined) delete globalThis.PerformanceObserver;
    else globalThis.PerformanceObserver = originalObserver;
  }
});
