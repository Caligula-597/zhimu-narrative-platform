/**
 * Lightweight Prometheus text exporter (no prom-client dependency).
 */

const httpRequests = new Map();
const httpErrors5xx = new Map();
const durationBuckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
/** @type {Map<string, { buckets: number[], sum: number, count: number }>} */
const httpDuration = new Map();
const uploadScans = new Map();
const uploadScanRejected = new Map();
const webVitals = new Map();
const cspViolations = new Map();
const sseEventOperations = new Map();
/** Histogram buckets by metric name (ms for LCP/INP/FCP/TTFB; unitless×1000 for CLS stored as raw). */
const webVitalBuckets = {
  LCP: [1000, 2500, 4000, 8000, 15000],
  INP: [100, 200, 500, 1000, 2000],
  FCP: [1000, 1800, 3000, 6000, 10000],
  TTFB: [200, 800, 1800, 3000, 8000],
  CLS: [0.05, 0.1, 0.25, 0.5, 1]
};
const webVitalApps = new Set(["app", "play", "host", "site", "unknown"]);
const webVitalRatings = new Set(["good", "needs-improvement", "poor", "unknown"]);
const webVitalMaximums = { LCP: 600_000, INP: 600_000, FCP: 600_000, TTFB: 600_000, CLS: 10 };
/** @type {Map<string, { buckets: number[], sum: number, count: number, le: number[] }>} */
const webVitalValues = new Map();
let apiReadyGauge = 1;

function routeKey(method, route) {
  return `${(method || "GET").toUpperCase()} ${route || "unknown"}`;
}

function inc(map, key, delta = 1) {
  map.set(key, (map.get(key) || 0) + delta);
}

function observeDuration(key, ms) {
  if (!httpDuration.has(key)) {
    httpDuration.set(key, { buckets: durationBuckets.map(() => 0), sum: 0, count: 0 });
  }
  const entry = httpDuration.get(key);
  for (let i = 0; i < durationBuckets.length; i++) {
    if (ms <= durationBuckets[i]) {
      entry.buckets[i]++;
    }
  }
  entry.sum += ms;
  entry.count++;
}

export function recordUploadScan({ mode = "none", result = "clean", reason = "" } = {}) {
  inc(uploadScans, `${mode}:${result}`);
  if (result === "rejected" || result === "error") {
    inc(uploadScanRejected, reason || result);
  }
}

export function recordWebVital({ name, app = "unknown", rating = "unknown", value } = {}) {
  if (!Object.hasOwn(webVitalMaximums, name)
    || !webVitalApps.has(app)
    || !webVitalRatings.has(rating)
    || !Number.isFinite(value)
    || value < 0
    || value > webVitalMaximums[name]) return;
  const safeRating = rating;
  inc(webVitals, `${app}:${name}:${safeRating}`);
  const le = webVitalBuckets[name];
  if (!le) return;
  const key = `${app}:${name}`;
  if (!webVitalValues.has(key)) {
    webVitalValues.set(key, { buckets: le.map(() => 0), sum: 0, count: 0, le: [...le] });
  }
  const entry = webVitalValues.get(key);
  for (let i = 0; i < entry.le.length; i++) {
    if (value <= entry.le[i]) entry.buckets[i]++;
  }
  entry.sum += value;
  entry.count++;
}

export function recordCspViolation({ directive = "unknown", disposition = "report" } = {}) {
  inc(cspViolations, `${disposition}:${directive}`);
}

export function recordSseEventOperation({ bus = "room", outcome = "published" } = {}) {
  inc(sseEventOperations, `${bus}:${outcome}`);
}

export function setApiReadyGauge(value) {
  apiReadyGauge = value ? 1 : 0;
}

export function recordHttpRequest({ method, route, statusCode, durationMs }) {
  const key = routeKey(method, route);
  inc(httpRequests, key);
  if (statusCode >= 500) {
    inc(httpErrors5xx, key);
  }
  observeDuration(key, durationMs);
}

function escapeLabel(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function formatLabels(labels) {
  const parts = Object.entries(labels).map(([k, v]) => `${k}="${escapeLabel(v)}"`);
  return parts.length ? `{${parts.join(",")}}` : "";
}

function renderCounter(name, help, map, labelParser = null) {
  const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} counter`];
  for (const [key, value] of map) {
    const labels = labelParser
      ? labelParser(key)
      : (() => {
          const [method, ...routeParts] = key.split(" ");
          return { method, route: routeParts.join(" ") };
        })();
    lines.push(`${name}${formatLabels(labels)} ${value}`);
  }
  return lines.join("\n");
}

function renderHistogram(name, help, map, labelParser) {
  const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} histogram`];
  for (const [key, entry] of map) {
    const baseLabels = labelParser(key);
    const leValues = entry.le || durationBuckets;
    for (let i = 0; i < leValues.length; i++) {
      lines.push(
        `${name}_bucket${formatLabels({ ...baseLabels, le: String(leValues[i]) })} ${entry.buckets[i]}`
      );
    }
    lines.push(`${name}_bucket${formatLabels({ ...baseLabels, le: "+Inf" })} ${entry.count}`);
    lines.push(`${name}_sum${formatLabels(baseLabels)} ${entry.sum}`);
    lines.push(`${name}_count${formatLabels(baseLabels)} ${entry.count}`);
  }
  return lines.join("\n");
}

function parseHttpDurationKey(key) {
  const [method, ...routeParts] = key.split(" ");
  return { method, route: routeParts.join(" ") };
}

function parseWebVitalCountKey(key) {
  const [app, name, rating] = key.split(":");
  return { app, name, rating };
}

function parseWebVitalKey(key) {
  const [app, name] = key.split(":");
  return { app, name };
}

function parseCspViolationKey(key) {
  const separator = key.indexOf(":");
  return {
    disposition: separator < 0 ? "report" : key.slice(0, separator),
    directive: separator < 0 ? key : key.slice(separator + 1)
  };
}

function parseSseEventOperationKey(key) {
  const [bus, outcome] = key.split(":");
  return { bus, outcome };
}

export function renderPrometheusMetrics({ poolStats = {}, sseStats = {}, platformSseStats = {}, eventOutboxStats = {}, uptimeSeconds = 0, readyOk = apiReadyGauge } = {}) {
  const sections = [
    renderCounter("http_requests_total", "Total HTTP requests", httpRequests),
    renderCounter("http_errors_5xx_total", "HTTP 5xx responses", httpErrors5xx),
    renderCounter("upload_scans_total", "Upload malware scans by mode and result", uploadScans),
    renderCounter("upload_scans_rejected_total", "Rejected or errored upload scans by reason", uploadScanRejected),
    renderCounter("web_vitals_total", "Frontend Core Web Vitals beacons by app/name/rating", webVitals, parseWebVitalCountKey),
    renderCounter("csp_violations_total", "CSP and Trusted Types violations by disposition/directive", cspViolations, parseCspViolationKey),
    renderCounter("sse_event_operations_total", "SSE event operations by bus and outcome", sseEventOperations, parseSseEventOperationKey),
    renderHistogram("http_request_duration_ms", "HTTP request duration in milliseconds", httpDuration, parseHttpDurationKey),
    renderHistogram("web_vital_value", "Frontend Core Web Vitals observed values by app/name", webVitalValues, parseWebVitalKey),
    `# HELP api_ready 1 when last readiness check passed`,
    `# TYPE api_ready gauge`,
    `api_ready ${readyOk ? 1 : 0}`,
    `# HELP process_uptime_seconds Process uptime`,
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds ${uptimeSeconds}`,
    `# HELP db_pool_total DB pool max connections`,
    `# TYPE db_pool_total gauge`,
    `db_pool_total ${poolStats.totalCount ?? 0}`,
    `# HELP db_pool_idle DB pool idle connections`,
    `# TYPE db_pool_idle gauge`,
    `db_pool_idle ${poolStats.idleCount ?? 0}`,
    `# HELP db_pool_waiting DB clients waiting for a connection`,
    `# TYPE db_pool_waiting gauge`,
    `db_pool_waiting ${poolStats.waitingCount ?? 0}`,
    `# HELP sse_connections_active Active SSE subscriber connections`,
    `# TYPE sse_connections_active gauge`,
    `sse_connections_active ${sseStats.connections ?? 0}`,
    `# HELP sse_rooms_with_subscribers Rooms with at least one SSE subscriber`,
    `# TYPE sse_rooms_with_subscribers gauge`,
    `sse_rooms_with_subscribers ${sseStats.rooms ?? 0}`,
    `# HELP platform_sse_connections_active Active platform SSE subscriber connections`,
    `# TYPE platform_sse_connections_active gauge`,
    `platform_sse_connections_active ${platformSseStats.connections ?? 0}`,
    `# HELP event_outbox_pending Events waiting for durable dispatch`,
    `# TYPE event_outbox_pending gauge`,
    `event_outbox_pending ${eventOutboxStats.pending ?? 0}`,
    `# HELP event_outbox_dead Events exhausted after durable dispatch retries`,
    `# TYPE event_outbox_dead gauge`,
    `event_outbox_dead ${eventOutboxStats.dead ?? 0}`,
    `# HELP event_outbox_oldest_pending_seconds Age of the oldest pending event`,
    `# TYPE event_outbox_oldest_pending_seconds gauge`,
    `event_outbox_oldest_pending_seconds ${eventOutboxStats.oldestPendingSeconds ?? 0}`,
    `# HELP event_outbox_processed_total Events durably dispatched by this process`,
    `# TYPE event_outbox_processed_total counter`,
    `event_outbox_processed_total ${eventOutboxStats.processed ?? 0}`,
    `# HELP event_outbox_failed_total Event dispatch attempts failed in this process`,
    `# TYPE event_outbox_failed_total counter`,
    `event_outbox_failed_total ${eventOutboxStats.failed ?? 0}`,
    `# HELP event_outbox_discarded_total Events safely discarded because their audience was deleted`,
    `# TYPE event_outbox_discarded_total counter`,
    `event_outbox_discarded_total ${eventOutboxStats.discarded ?? 0}`
  ];
  return `${sections.filter(Boolean).join("\n")}\n`;
}

export function resolveMetricRoute(request) {
  return request.routeOptions?.url || request.routerPath || request.url.split("?")[0];
}

export function resetMetricsForTests() {
  httpRequests.clear();
  httpErrors5xx.clear();
  httpDuration.clear();
  uploadScans.clear();
  uploadScanRejected.clear();
  webVitals.clear();
  cspViolations.clear();
  sseEventOperations.clear();
  webVitalValues.clear();
  apiReadyGauge = 1;
}
