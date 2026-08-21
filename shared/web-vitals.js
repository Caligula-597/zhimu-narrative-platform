/**
 * Lightweight Core Web Vitals observer for app / play / host shells.
 * Computes rating thresholds and reports value + rating to the backend.
 */

/** @typedef {{ name: string, value: number, rating: string, id: string, path?: string }} WebVitalMetric */

export const WEB_VITAL_NAMES = Object.freeze(["LCP", "CLS", "INP", "FCP", "TTFB"]);
export const WEB_VITAL_APPS = Object.freeze(["app", "play", "host", "site", "unknown"]);
export const WEB_VITAL_RATINGS = Object.freeze(["good", "needs-improvement", "poor", "unknown"]);
export const DEFAULT_WEB_VITAL_APP = "unknown";

/** Web Vitals thresholds (ms for LCP/INP/FCP/TTFB; unitless for CLS). */
export const WEB_VITAL_THRESHOLDS = Object.freeze({
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 }
});

/**
 * @param {string} name
 * @param {number} value
 * @returns {"good"|"needs-improvement"|"poor"|"unknown"}
 */
export function rateWebVital(name, value) {
  const thresholds = WEB_VITAL_THRESHOLDS[name];
  if (!thresholds || !Number.isFinite(value)) return "unknown";
  if (value <= thresholds.good) return "good";
  if (value <= thresholds.poor) return "needs-improvement";
  return "poor";
}

/**
 * @param {Omit<WebVitalMetric, "rating"> & { rating?: string }} metric
 * @param {{ endpoint?: string, app?: string, debug?: boolean, onMetric?: (metric: WebVitalMetric) => void }} [options]
 */
export function reportWebVital(metric, options = {}) {
  const rating = metric.rating || rateWebVital(metric.name, metric.value);
  const enriched = { ...metric, rating };
  options.onMetric?.(enriched);
  if (options.debug && typeof console !== "undefined") {
    console.info(`[web-vitals] ${enriched.name}=${enriched.value} (${enriched.rating})`, enriched);
  }
  const endpoint = options.endpoint;
  if (!endpoint || typeof navigator === "undefined") return;
  const body = JSON.stringify({
    name: enriched.name,
    value: enriched.value,
    rating: enriched.rating,
    id: enriched.id,
    path: enriched.path || globalThis.location?.pathname || "/",
    app: options.app || "unknown"
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    return;
  }
  fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
    signal: AbortSignal.timeout(10_000)
  }).catch(() => {});
}

/**
 * @param {{ endpoint?: string, app?: string, debug?: boolean, onMetric?: (metric: WebVitalMetric) => void }} [options]
 */
export function initWebVitalsReporting(options = {}) {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return () => {};

  const disposers = [];
  const path = () => globalThis.location?.pathname || "/";
  let latestLcp = null;
  let currentCls = 0;
  let slowestInteraction = null;
  let observesCls = false;
  let flushed = false;

  const flush = () => {
    if (flushed) return;
    flushed = true;
    if (latestLcp) reportWebVital(latestLcp, options);
    if (observesCls) {
      reportWebVital({
        name: "CLS",
        value: currentCls,
        id: `cls-${Date.now()}`,
        path: path()
      }, options);
    }
    if (slowestInteraction) reportWebVital(slowestInteraction, options);
  };

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (!last) return;
      latestLcp = {
        name: "LCP",
        value: last.startTime,
        id: `lcp-${Date.now()}`,
        path: path()
      };
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    disposers.push(() => lcpObserver.disconnect());
  } catch {
    // unsupported
  }

  try {
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) currentCls += entry.value;
      }
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
    observesCls = true;
    disposers.push(() => clsObserver.disconnect());
  } catch {
    // unsupported
  }

  try {
    const inpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!slowestInteraction || entry.duration > slowestInteraction.value) {
          slowestInteraction = {
            name: "INP",
            value: entry.duration,
            id: entry.interactionId ? String(entry.interactionId) : `inp-${Date.now()}`,
            path: path()
          };
        }
      }
    });
    inpObserver.observe({ type: "event", buffered: true, durationThreshold: 40 });
    disposers.push(() => inpObserver.disconnect());
  } catch {
    // unsupported
  }

  const flushWhenHidden = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", flushWhenHidden);
  window.addEventListener("pagehide", flush, { once: true });

  return () => {
    flush();
    disposers.forEach((dispose) => dispose());
    document.removeEventListener("visibilitychange", flushWhenHidden);
    window.removeEventListener("pagehide", flush);
  };
}
