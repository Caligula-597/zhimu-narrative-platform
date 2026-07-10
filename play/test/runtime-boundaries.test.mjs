import assert from "node:assert/strict";
import test from "node:test";
import { resolveInitialRoute } from "../src/runtime/router.js";
import { normalizeSessionUser } from "../src/runtime/session-controller.js";

test("resolveInitialRoute restores a valid active game room", () => {
  const state = { roomId: "room-ok", inviteCode: "", view: "landing" };
  const params = new URLSearchParams();
  resolveInitialRoute({
    state,
    params,
    normalizeInviteCode: (value) => value,
    isUuid: (value) => value === "room-ok",
    persistRoom: () => assert.fail("valid room must not be cleared")
  });
  assert.equal(state.view, "game");
});

test("resolveInitialRoute clears an invalid persisted room", () => {
  const state = { roomId: "invalid", inviteCode: "", view: "landing" };
  let cleared = false;
  resolveInitialRoute({
    state,
    params: new URLSearchParams(),
    normalizeInviteCode: (value) => value,
    isUuid: () => false,
    persistRoom: (roomId) => { cleared = roomId === ""; }
  });
  assert.equal(cleared, true);
});

test("normalizeSessionUser supports snake_case API payloads", () => {
  assert.deepEqual(normalizeSessionUser({
    id: "u1",
    email: "u@example.test",
    display_name: "Player",
    user_kind: "guest",
    email_verified_at: null
  }), {
    id: "u1",
    email: "u@example.test",
    displayName: "Player",
    isGuest: true,
    emailVerified: false
  });
});
