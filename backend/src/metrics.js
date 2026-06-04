/**
 * Lightweight Prometheus text exporter (no prom-client dependency).
 */

const httpRequests = new Map();
const httpErrors5xx = new Map();
const durationBuckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
/** @type {Map<string, { buckets: number[], sum: number, count: number }>} */
const httpDuration = new Map();

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

function renderCounter(name, help, map) {
  const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} counter`];
  for (const [key, value] of map) {
    const [method, ...routeParts] = key.split(" ");
    lines.push(`${name}${formatLabels({ method, route: routeParts.join(" ") })} ${value}`);
  }
  return lines.join("\n");
}

function renderHistogram(name, help) {
  const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} histogram`];
  for (const [key, entry] of httpDuration) {
    const [method, ...routeParts] = key.split(" ");
    const route = routeParts.join(" ");
    const baseLabels = { method, route };
    let cumulative = 0;
    for (let i = 0; i < durationBuckets.length; i++) {
      cumulative += entry.buckets[i];
      lines.push(
        `${name}_bucket${formatLabels({ ...baseLabels, le: String(durationBuckets[i]) })} ${cumulative}`
      );
    }
    lines.push(`${name}_bucket${formatLabels({ ...baseLabels, le: "+Inf" })} ${entry.count}`);
    lines.push(`${name}_sum${formatLabels(baseLabels)} ${entry.sum}`);
    lines.push(`${name}_count${formatLabels(baseLabels)} ${entry.count}`);
  }
  return lines.join("\n");
}

export function renderPrometheusMetrics({ poolStats = {}, sseStats = {}, uptimeSeconds = 0 } = {}) {
  const sections = [
    renderCounter("http_requests_total", "Total HTTP requests", httpRequests),
    renderCounter("http_errors_5xx_total", "HTTP 5xx responses", httpErrors5xx),
    renderHistogram("http_request_duration_ms", "HTTP request duration in milliseconds"),
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
    `sse_rooms_with_subscribers ${sseStats.rooms ?? 0}`
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
}
