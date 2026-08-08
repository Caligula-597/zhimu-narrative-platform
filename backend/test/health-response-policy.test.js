import assert from "node:assert/strict";
import test from "node:test";
import { healthResponseBody } from "../src/health-response-policy.js";

function request(headers = {}) {
  return { headers };
}

test("production health responses hide infrastructure details from anonymous clients", () => {
  const detailed = {
    ok: true,
    ready: true,
    database: { missingTables: ["private_table"], migrationsApplied: 108 },
    pool: { total: 4 },
    optionalServices: { r2: true }
  };
  assert.deepEqual(
    healthResponseBody(request(), detailed, { nodeEnv: "production", readiness: true }),
    { ok: true, ready: true }
  );
});

test("a valid production ops token can inspect detailed readiness", () => {
  const previous = { nodeEnv: process.env.NODE_ENV, opsToken: process.env.OPS_API_TOKEN };
  process.env.NODE_ENV = "production";
  process.env.OPS_API_TOKEN = "ops-diagnostic-token-123";
  try {
    const detailed = { ok: false, ready: false, checks: { database: false } };
    assert.equal(
      healthResponseBody(
        request({ "x-ops-token": "ops-diagnostic-token-123" }),
        detailed,
        { nodeEnv: "production", readiness: true }
      ),
      detailed
    );
    assert.deepEqual(
      healthResponseBody(
        request({ "x-ops-token": "wrong-token-value" }),
        detailed,
        { nodeEnv: "production", readiness: true }
      ),
      { ok: false, ready: false }
    );
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.opsToken === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = previous.opsToken;
  }
});

test("development health responses retain full local diagnostics", () => {
  const detailed = { ok: true, latencyMs: 8, pool: { total: 1 } };
  assert.equal(healthResponseBody(request(), detailed, { nodeEnv: "development" }), detailed);
});

test("production details reject configured tokens below the minimum strength", () => {
  const previous = process.env.OPS_API_TOKEN;
  process.env.OPS_API_TOKEN = "short-token";
  try {
    const detailed = { ok: true, ready: true, pool: { total: 3 } };
    assert.deepEqual(
      healthResponseBody(
        request({ "x-ops-token": "short-token" }),
        detailed,
        { nodeEnv: "production", readiness: true }
      ),
      { ok: true, ready: true }
    );
  } finally {
    if (previous === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = previous;
  }
});
