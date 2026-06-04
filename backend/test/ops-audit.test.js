import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";

test("GET /api/ops/audit-log requires OPS_API_TOKEN", async (context) => {
  const previous = process.env.OPS_API_TOKEN;
  delete process.env.OPS_API_TOKEN;
  context.after(() => {
    if (previous === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = previous;
  });

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/api/ops/audit-log" });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().code, "OPS_NOT_CONFIGURED");
});

test("GET /api/ops/audit-log returns paginated rows with token", async (context) => {
  const previous = process.env.OPS_API_TOKEN;
  process.env.OPS_API_TOKEN = "test-ops-token";
  context.after(() => {
    if (previous === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = previous;
  });

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const denied = await app.inject({ method: "GET", url: "/api/ops/audit-log" });
  assert.equal(denied.statusCode, 401);

  const allowed = await app.inject({
    method: "GET",
    url: "/api/ops/audit-log?limit=5",
    headers: { "x-ops-token": "test-ops-token" }
  });
  assert.equal(allowed.statusCode, 200);
  const body = allowed.json();
  assert.ok(Array.isArray(body.items));
  assert.equal(body.limit, 5);
  assert.ok(typeof body.total === "number");
});

test("GET /api/ops/status returns readiness snapshot", async (context) => {
  const previous = process.env.OPS_API_TOKEN;
  process.env.OPS_API_TOKEN = "test-ops-token";
  context.after(() => {
    if (previous === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = previous;
  });

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/api/ops/status",
    headers: { "x-ops-token": "test-ops-token" }
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(typeof body.ready === "boolean");
  assert.ok(body.pool);
  assert.ok(body.features);
});
