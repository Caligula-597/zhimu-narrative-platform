/**
 * Lightweight Core Web Vitals observer for app / play / host shells.
 * Reports via callback and optional beacon to backend metrics endpoint.
 */

/** @typedef {{ name: string, value: number, rating?: string, id: string, path?: string }} WebVitalMetric */

/**
 * @param {WebVitalMetric} metric
 * @param {{ endpoint?: string, app?: string, debug?: boolean, onMetric?: (metric: WebVitalMetric) => void }} [options]
 */
export function reportWebVital(metric, options = {}) {
  options.onMetric?.(metric);
  if (options.debug && typeof console !== "undefined") {
    console.info(`[web-vitals] ${metric.name}=${metric.value}`, metric);
  }
  const endpoint = options.endpoint;
  if (!endpoint || typeof navigator === "undefined") return;
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    path: metric.path || globalThis.location?.pathname || "/",
    app: options.app || "unknown"
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, body);
    return;
  }
  fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
}

/**
 * @param {{ endpoint?: string, app?: string, debug?: boolean, onMetric?: (metric: WebVitalMetric) => void }} [options]
 */
export function initWebVitalsReporting(options = {}) {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return () => {};

  const disposers = [];
  const path = () => globalThis.location?.pathname || "/";

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (!last) return;
      reportWebVital({
        name: "LCP",
        value: last.startTime,
        id: `lcp-${Date.now()}`,
        path: path()
      }, options);
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    disposers.push(() => lcpObserver.disconnect());
  } catch {
    // unsupported
  }

  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) clsValue += entry.value;
      }
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
    disposers.push(() => {
      clsObserver.disconnect();
      reportWebVital({
        name: "CLS",
        value: clsValue,
        id: `cls-${Date.now()}`,
        path: path()
      }, options);
    });
  } catch {
    // unsupported
  }

  try {
    const inpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        reportWebVital({
          name: "INP",
          value: entry.duration,
          id: entry.interactionId ? String(entry.interactionId) : `inp-${Date.now()}`,
          path: path()
        }, options);
      }
    });
    inpObserver.observe({ type: "event", buffered: true, durationThreshold: 40 });
    disposers.push(() => inpObserver.disconnect());
  } catch {
    // unsupported
  }

  return () => disposers.forEach((dispose) => dispose());
}
