import assert from "node:assert/strict";
import test from "node:test";
import { resolveRequestActor } from "../src/request-actor.js";

function request(headers = {}) {
  return { headers };
}

test("session identity wins over a spoofed demo header", async () => {
  const value = request({ authorization: "Bearer valid-session-token-123", "x-user-id": "spoofed-user" });
  const actorId = await resolveRequestActor(value, {
    allowDemoUserHeader: true,
    resolveSession: async () => ({ userId: "session-user", sessionId: "sess-1" })
  });
  assert.equal(actorId, "session-user");
  assert.equal(value.actorId, "session-user");
  assert.equal(value.sessionId, "sess-1");
  assert.equal(value.authSource, "session");
  assert.equal(value.authTransport, "bearer");
});

test("a rejected stale bearer falls back to a valid HttpOnly cookie session", async () => {
  const staleBearer = "stale-session-token-123";
  const validCookie = "valid-cookie-token-456";
  const resolved = [];
  const value = request({
    authorization: `Bearer ${staleBearer}`,
    cookie: `zhimu_session=${validCookie}`
  });
  const actorId = await resolveRequestActor(value, {
    resolveSession: async (token) => {
      resolved.push(token);
      return token === validCookie ? { userId: "cookie-user", sessionId: "sess-cookie" } : null;
    }
  });

  assert.deepEqual(resolved, [staleBearer, validCookie]);
  assert.equal(actorId, "cookie-user");
  assert.equal(value.sessionId, "sess-cookie");
  assert.equal(value.authTransport, "cookie");
});

test("demo header is ignored by default", async () => {
  const value = request({ "x-user-id": "demo-user" });
  const actorId = await resolveRequestActor(value, {
    resolveSession: async () => null
  });
  assert.equal(actorId, null);
  assert.equal(value.actorId, undefined);
  assert.equal(value.authTransport, null);
});

test("demo header only works when explicitly enabled", async () => {
  const value = request({ "x-user-id": "demo-user" });
  const actorId = await resolveRequestActor(value, {
    allowDemoUserHeader: true,
    resolveSession: async () => null
  });
  assert.equal(actorId, "demo-user");
  assert.equal(value.authSource, "demo-header");
  assert.equal(value.authTransport, null);
});
