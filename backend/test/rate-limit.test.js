import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { resetRateLimitersForTests } from "../src/rate-limit.js";

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
