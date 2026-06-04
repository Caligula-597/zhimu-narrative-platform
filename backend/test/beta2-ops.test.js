import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { getTelemetryStatus } from "../src/telemetry.js";

test("getTelemetryStatus reports disabled when OTEL not configured", () => {
  const previous = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  delete process.env.OTEL_ENABLED;
  const status = getTelemetryStatus();
  assert.equal(status.exporter, "none");
  assert.equal(status.enabled, false);
  if (previous) process.env.OTEL_EXPORTER_OTLP_ENDPOINT = previous;
});

test("GET /api/ops/status includes rate limit and telemetry metadata", async (context) => {
  const previous = process.env.OPS_API_TOKEN;
  process.env.OPS_API_TOKEN = "ops-test-token";
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/api/ops/status",
    headers: { "x-ops-token": "ops-test-token" }
  });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.ok(payload.rateLimits);
  assert.equal(typeof payload.rateLimits.uploadPerMin, "number");
  assert.ok(payload.features?.telemetry);
  if (previous === undefined) delete process.env.OPS_API_TOKEN;
  else process.env.OPS_API_TOKEN = previous;
});
