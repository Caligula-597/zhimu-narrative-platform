import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { recordHttpRequest, renderPrometheusMetrics, resetMetricsForTests } from "../src/metrics.js";

test("HTTP duration histogram exports cumulative buckets exactly once", () => {
  resetMetricsForTests();
  recordHttpRequest({ method: "GET", route: "/api/example", statusCode: 200, durationMs: 4 });
  recordHttpRequest({ method: "GET", route: "/api/example", statusCode: 200, durationMs: 20 });

  const metrics = renderPrometheusMetrics();
  assert.match(metrics, /http_request_duration_ms_bucket\{method="GET",route="\/api\/example",le="5"\} 1/);
  assert.match(metrics, /http_request_duration_ms_bucket\{method="GET",route="\/api\/example",le="10"\} 1/);
  assert.match(metrics, /http_request_duration_ms_bucket\{method="GET",route="\/api\/example",le="25"\} 2/);
  assert.match(metrics, /http_request_duration_ms_count\{method="GET",route="\/api\/example"\} 2/);
});

test("GET /metrics returns Prometheus text", async (context) => {
  const previousToken = process.env.METRICS_TOKEN;
  delete process.env.METRICS_TOKEN;
  context.after(() => {
    if (previousToken === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = previousToken;
  });

  resetMetricsForTests();
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  await app.inject({ method: "GET", url: "/api/health/live" });
  const response = await app.inject({ method: "GET", url: "/metrics" });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"], /text\/plain/);
  assert.match(response.body, /http_requests_total/);
  assert.match(response.body, /db_pool_waiting/);
  assert.match(response.body, /sse_connections_active/);
  assert.match(response.body, /event_outbox_pending/);
  assert.match(response.body, /event_outbox_oldest_pending_seconds/);
  assert.match(response.body, /event_outbox_discarded_total/);
  assert.match(response.body, /sse_connection_admissions_total/);
  assert.match(response.body, /sse_connection_limit\{scope="total"\}/);
});

test("GET /metrics rejects invalid token when METRICS_TOKEN is set", async (context) => {
  const previous = process.env.METRICS_TOKEN;
  process.env.METRICS_TOKEN = "test-metrics-secret";
  context.after(() => {
    if (previous === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = previous;
  });

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const denied = await app.inject({ method: "GET", url: "/metrics" });
  assert.equal(denied.statusCode, 401);

  const allowed = await app.inject({
    method: "GET",
    url: "/metrics",
    headers: { "x-metrics-token": "test-metrics-secret" }
  });
  assert.equal(allowed.statusCode, 200);
});

test("responses include X-Trace-Id", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/api/health/live",
    headers: { traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" }
  });
  assert.equal(response.headers["x-trace-id"], "4bf92f3577b34da6a3ce929d0e0e4736");
});

test("GET /metrics rejects with 503 when METRICS_TOKEN is missing in production", async (context) => {
  const previousToken = process.env.METRICS_TOKEN;
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.METRICS_TOKEN;
  process.env.NODE_ENV = "production";
  context.after(() => {
    if (previousToken === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = previousToken;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const denied = await app.inject({ method: "GET", url: "/metrics" });
  assert.equal(denied.statusCode, 503);
});

test("GET /metrics accepts valid token using constant-time comparison", async (context) => {
  const previous = process.env.METRICS_TOKEN;
  process.env.METRICS_TOKEN = "test-metrics-secret";
  context.after(() => {
    if (previous === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = previous;
  });

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const allowed = await app.inject({
    method: "GET",
    url: "/metrics",
    headers: { "x-metrics-token": "test-metrics-secret" }
  });
  assert.equal(allowed.statusCode, 200);

  const wrongLength = await app.inject({
    method: "GET",
    url: "/metrics",
    headers: { "x-metrics-token": "test-metrics-secret-extra" }
  });
  assert.equal(wrongLength.statusCode, 401);
});
