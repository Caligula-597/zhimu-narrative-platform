import assert from "node:assert/strict";
import test from "node:test";
import { resetRateLimitersForTests } from "../src/rate-limit.js";

test("script-bundle network admission rejects before malformed JSON is parsed", async () => {
  const previous = process.env.RATE_LIMIT_SCRIPT_BUNDLE_IP_MAX;
  process.env.RATE_LIMIT_SCRIPT_BUNDLE_IP_MAX = "2";
  resetRateLimitersForTests();
  const { createApp } = await import(`../src/app.js?preparse-limit=${Date.now()}`);
  const app = await createApp({ logger: false, rateLimit: true, allowDemoUserHeader: false });
  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/script-bundle/preview-new-world",
        headers: { "content-type": "application/json" },
        payload: "{"
      });
      assert.equal(response.statusCode, 400);
    }
    const rejected = await app.inject({
      method: "POST",
      url: "/api/script-bundle/preview-new-world",
      headers: { "content-type": "application/json" },
      payload: "{"
    });
    assert.equal(rejected.statusCode, 429);
    assert.equal(rejected.json().code, "RATE_LIMITED");
  } finally {
    await app.close();
    resetRateLimitersForTests();
    if (previous === undefined) delete process.env.RATE_LIMIT_SCRIPT_BUNDLE_IP_MAX;
    else process.env.RATE_LIMIT_SCRIPT_BUNDLE_IP_MAX = previous;
  }
});

test("content-package network admission rejects before a large JSON body is parsed", async () => {
  const previous = process.env.RATE_LIMIT_SCRIPT_BUNDLE_IP_MAX;
  process.env.RATE_LIMIT_SCRIPT_BUNDLE_IP_MAX = "2";
  resetRateLimitersForTests();
  const { createApp } = await import(`../src/app.js?content-package-preparse-limit=${Date.now()}`);
  const app = await createApp({ logger: false, rateLimit: true, allowDemoUserHeader: false });
  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/content-package/preview-new-world",
        headers: { "content-type": "application/json" },
        payload: "{"
      });
      assert.equal(response.statusCode, 400);
    }
    const rejected = await app.inject({
      method: "POST",
      url: "/api/content-package/preview-new-world",
      headers: { "content-type": "application/json" },
      payload: "{"
    });
    assert.equal(rejected.statusCode, 429);
    assert.equal(rejected.json().code, "RATE_LIMITED");
  } finally {
    await app.close();
    resetRateLimitersForTests();
    if (previous === undefined) delete process.env.RATE_LIMIT_SCRIPT_BUNDLE_IP_MAX;
    else process.env.RATE_LIMIT_SCRIPT_BUNDLE_IP_MAX = previous;
  }
});
