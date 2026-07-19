import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createRateLimiter, getRateLimiterStats, resetRateLimitersForTests } from "../src/rate-limit.js";

test("rate limiter isolates authenticated actors and emits standard headers", async () => {
  resetRateLimitersForTests();
  const limiter = createRateLimiter({ windowMs: 10_000, max: 1, routeKey: "unit" });
  const headers = {};
  const reply = { header(name, value) { headers[name] = value; } };
  await limiter({ actorId: "actor-a", ip: "127.0.0.1", headers: {} }, reply);
  await limiter({ actorId: "actor-b", ip: "127.0.0.1", headers: {} }, reply);
  await assert.rejects(
    () => limiter({ actorId: "actor-a", ip: "127.0.0.1", headers: {} }, reply),
    (error) => error.code === "RATE_LIMITED"
  );
  assert.equal(headers["RateLimit-Limit"], "1");
  assert.equal(headers["RateLimit-Remaining"], "0");
  assert.equal(getRateLimiterStats().buckets, 2);
  resetRateLimitersForTests();
});

test("auth routes return RATE_LIMITED after threshold", async (context) => {
  resetRateLimitersForTests();
  const app = await createApp({ logger: false, rateLimit: true });
  context.after(() => app.close());

  let lastStatus = 200;
  for (let attempt = 0; attempt < 22; attempt += 1) {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "missing@example.com", password: "wrong-password" }
    });
    lastStatus = response.statusCode;
  }

  assert.equal(lastStatus, 429);
  resetRateLimitersForTests();
});

test("write API routes return RATE_LIMITED after threshold", async (context) => {
  resetRateLimitersForTests();
  const app = await createApp({ logger: false, rateLimit: true });
  context.after(() => app.close());

  let lastStatus = 200;
  for (let attempt = 0; attempt < 122; attempt += 1) {
    const response = await app.inject({
      method: "POST",
      url: "/api/rooms/00000000-0000-4000-8000-000000000099/checkpoints",
      payload: { title: "rate-limit-probe" }
    });
    lastStatus = response.statusCode;
  }

  assert.equal(lastStatus, 429);
  resetRateLimitersForTests();
});

test("upload routes return RATE_LIMITED after threshold", async (context) => {
  resetRateLimitersForTests();
  const app = await createApp({ logger: false, rateLimit: true });
  context.after(() => app.close());

  let lastStatus = 200;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const response = await app.inject({
      method: "POST",
      url: "/api/assets/upload-url",
      payload: {
        worldId: "00000000-0000-4000-8000-000000000001",
        filename: "x.png",
        contentType: "image/png",
        byteSize: 1
      }
    });
    lastStatus = response.statusCode;
  }

  assert.equal(lastStatus, 429);
  resetRateLimitersForTests();
});

test("document processing routes use the lower-cost abuse threshold", async (context) => {
  resetRateLimitersForTests();
  const app = await createApp({ logger: false, rateLimit: true });
  context.after(() => app.close());

  let response;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    response = await app.inject({
      method: "POST",
      url: "/api/worlds/00000000-0000-4000-8000-000000000001/documents/parse",
      payload: {
        filename: "probe.txt",
        contentBase64: Buffer.from("probe").toString("base64")
      }
    });
  }
  assert.equal(response.statusCode, 429, response.body);
  assert.equal(response.json().code, "RATE_LIMITED");
  resetRateLimitersForTests();
});
