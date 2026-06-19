import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";

test("GET /api/health/ready returns 200 when database is healthy", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/api/health/ready" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.ready, true);
  assert.equal(body.checks.database, true);
  assert.ok(body.pool);
  assert.ok(typeof body.pool.total === "number");
  assert.ok(body.roomEventBus);
  assert.ok(body.optionalServices);
  assert.equal(typeof body.optionalServices.r2, "boolean");
});

test("responses include X-Request-Id", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/api/health/live" });
  assert.ok(response.headers["x-request-id"]);
});

test("asset upload-url rejects invalid schema body", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/assets/upload-url",
    headers: { "x-user-id": "154aa8a9-9cd2-4098-90f4-c75e56c0cc53" },
    payload: { worldId: "not-a-uuid", filename: "x.png", contentType: "image/png", byteSize: 100 }
  });
  assert.equal(response.statusCode, 400);
});
