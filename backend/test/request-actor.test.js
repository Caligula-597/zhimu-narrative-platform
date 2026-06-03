import assert from "node:assert/strict";
import test from "node:test";
import { resolveRequestActor } from "../src/request-actor.js";

function request(headers = {}) {
  return { headers };
}

test("session identity wins over a spoofed demo header", async () => {
  const value = request({ authorization: "Bearer valid-session", "x-user-id": "spoofed-user" });
  const actorId = await resolveRequestActor(value, {
    allowDemoUserHeader: true,
    resolveSession: async () => "session-user"
  });
  assert.equal(actorId, "session-user");
  assert.equal(value.actorId, "session-user");
  assert.equal(value.authSource, "session");
});

test("demo header is ignored by default", async () => {
  const value = request({ "x-user-id": "demo-user" });
  const actorId = await resolveRequestActor(value, {
    resolveSession: async () => null
  });
  assert.equal(actorId, null);
  assert.equal(value.actorId, undefined);
});

test("demo header only works when explicitly enabled", async () => {
  const value = request({ "x-user-id": "demo-user" });
  const actorId = await resolveRequestActor(value, {
    allowDemoUserHeader: true,
    resolveSession: async () => null
  });
  assert.equal(actorId, "demo-user");
  assert.equal(value.authSource, "demo-header");
});
