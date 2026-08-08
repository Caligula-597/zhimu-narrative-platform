import assert from "node:assert/strict";
import test from "node:test";
import {
  applySensitiveResponseHeaders,
  isSensitiveApiResponse
} from "../src/security-headers.js";

function replyFixture(initial = {}) {
  const headers = new Map(Object.entries(initial).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    statusCode: 200,
    header(key, value) {
      headers.set(String(key).toLowerCase(), value);
      return this;
    },
    getHeader(key) {
      return headers.get(String(key).toLowerCase());
    },
    headers
  };
}

test("authentication and cookie-backed API responses cannot be cached", () => {
  for (const request of [
    { method: "POST", url: "/api/auth/login", headers: {} },
    { method: "GET", url: "/api/worlds", actorId: "user-1", headers: {} },
    { method: "GET", url: "/api/platform/site", headers: { cookie: "zhimu_session=token" } }
  ]) {
    const reply = replyFixture({ vary: "Origin" });
    applySensitiveResponseHeaders(request, reply);
    assert.equal(reply.getHeader("cache-control"), "private, no-store, no-transform, max-age=0");
    assert.equal(reply.getHeader("pragma"), "no-cache");
    assert.equal(reply.getHeader("surrogate-control"), "no-store");
    assert.equal(reply.getHeader("vary"), "Origin, Authorization, Cookie");
  }
});

test("public immutable avatars and static files retain their dedicated cache policy", () => {
  const avatarRequest = {
    method: "GET",
    url: "/api/account/portal-avatars/user-1/player",
    actorId: "user-1",
    headers: { cookie: "zhimu_session=token" }
  };
  const avatarReply = replyFixture({ "cache-control": "public, max-age=31536000, immutable" });
  assert.equal(isSensitiveApiResponse(avatarRequest, avatarReply), false);
  applySensitiveResponseHeaders(avatarRequest, avatarReply);
  assert.equal(avatarReply.getHeader("cache-control"), "public, max-age=31536000, immutable");

  const staticReply = replyFixture({ "cache-control": "public, max-age=31536000, immutable" });
  applySensitiveResponseHeaders({ method: "GET", url: "/assets/app-hash.js", headers: {} }, staticReply);
  assert.equal(staticReply.getHeader("cache-control"), "public, max-age=31536000, immutable");
});

test("Set-Cookie makes an otherwise public API response private", () => {
  const reply = replyFixture({ "set-cookie": "zhimu_session=token; HttpOnly" });
  applySensitiveResponseHeaders({ method: "POST", url: "/api/platform/beta/apply", headers: {} }, reply);
  assert.equal(reply.getHeader("cache-control"), "private, no-store, no-transform, max-age=0");
});

test("health and metrics diagnostics are never cached", () => {
  for (const url of ["/api/health", "/api/health/ready", "/metrics"]) {
    const reply = replyFixture();
    applySensitiveResponseHeaders({ method: "GET", url, headers: {} }, reply);
    assert.equal(reply.getHeader("cache-control"), "private, no-store, no-transform, max-age=0");
  }
});
