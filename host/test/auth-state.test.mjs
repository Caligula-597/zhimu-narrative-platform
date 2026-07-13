import test from "node:test";
import assert from "node:assert/strict";

import {
  loadHostSessionUser,
  normalizeHostUser
} from "../src/runtime/host-lifecycle-controller.js";

test("host normalizes flat /auth/me payload", () => {
  assert.deepEqual(normalizeHostUser({
    id: "user-1",
    email: "one@example.com",
    display_name: "One",
    email_verified_at: "2026-01-01"
  }), {
    id: "user-1",
    email: "one@example.com",
    displayName: "One",
    emailVerified: true
  });
});

test("host preserves the last known user when auth cannot be checked", async () => {
  const knownUser = { id: "user-1", displayName: "One" };
  const state = { user: knownUser, authStatus: "authenticated", authError: "" };
  let cleared = false;
  await loadHostSessionUser({
    requestMe: async () => { throw Object.assign(new Error("gateway unavailable"), { status: 503 }); },
    stateRef: state,
    clear: () => { cleared = true; }
  });
  assert.equal(state.user, knownUser);
  assert.equal(state.authStatus, "unavailable");
  assert.equal(cleared, false);
});

test("host clears the session only after an explicit 401", async () => {
  const state = { user: { id: "user-1" }, authStatus: "authenticated", authError: "" };
  let cleared = false;
  await loadHostSessionUser({
    requestMe: async () => { throw Object.assign(new Error("unauthorized"), { status: 401 }); },
    stateRef: state,
    clear: () => { cleared = true; }
  });
  assert.equal(state.user, null);
  assert.equal(state.authStatus, "anonymous");
  assert.equal(cleared, true);
});
