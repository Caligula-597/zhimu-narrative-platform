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
  assert.ok(body.platformEventBus);
  assert.equal(body.checks.platformEventBus, true);
  assert.ok(body.optionalServices);
  assert.equal(typeof body.optionalServices.r2, "boolean");
});

test("production readiness rejects an explicitly in-memory event bus", async (context) => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousBus = process.env.ROOM_EVENTS_BUS;
  process.env.NODE_ENV = "production";
  process.env.ROOM_EVENTS_BUS = "memory";
  const app = await createApp({ logger: false, nodeEnv: "production", allowDemoUserHeader: false });
  context.after(async () => {
    await app.close();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousBus === undefined) delete process.env.ROOM_EVENTS_BUS;
    else process.env.ROOM_EVENTS_BUS = previousBus;
  });

  const response = await app.inject({ method: "GET", url: "/api/health/ready" });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().checks.roomEventBus, false);
  assert.equal(response.json().checks.platformEventBus, false);
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
