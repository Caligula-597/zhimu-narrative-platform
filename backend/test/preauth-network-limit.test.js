import assert from "node:assert/strict";
import test from "node:test";
import { resetRateLimitersForTests } from "../src/rate-limit.js";

test("global API network admission runs before auth and schema work", async (context) => {
  const previous = process.env.RATE_LIMIT_API_IP_MAX;
  process.env.RATE_LIMIT_API_IP_MAX = "2";
  resetRateLimitersForTests();
  context.after(() => {
    resetRateLimitersForTests();
    if (previous === undefined) delete process.env.RATE_LIMIT_API_IP_MAX;
    else process.env.RATE_LIMIT_API_IP_MAX = previous;
  });

  const { createApp } = await import(`../src/app.js?preauth-network-limit=${Date.now()}`);
  const app = await createApp({ logger: false, rateLimit: true });
  context.after(() => app.close());

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const rejectedBySchema = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "incomplete@example.com" }
    });
    assert.equal(rejectedBySchema.statusCode, 400);
  }

  const rateLimited = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "incomplete@example.com" }
  });
  assert.equal(rateLimited.statusCode, 429, rateLimited.body);
  assert.equal(rateLimited.json().code, "RATE_LIMITED");
});
