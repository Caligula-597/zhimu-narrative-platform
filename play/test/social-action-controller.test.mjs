import assert from "node:assert/strict";
import test from "node:test";
import { handlePlaySocialAction } from "../src/runtime/social-action-controller.js";

function setup(overrides = {}) {
  const calls = [];
  const record = (name) => async (...args) => calls.push([name, ...args]);
  const state = {};
  return {
    calls,
    state,
    options: {
      action: "unknown",
      button: { dataset: {} }, state, api: {},
      render: record("render"), setBusy: record("busy"), setToast: record("toast"),
      formatApiError: (_error, fallback) => fallback,
      openModalState: record("modal"), closeModalState: record("close-modal"),
      normalizeInviteCode: (value) => value.trim(), syncPlatformStream: record("stream"),
      loadPublicRooms: record("rooms"), loadPlazaPosts: record("posts"),
      openPlazaThread: record("post"), handlePlazaReport: record("report"),
      submitPlazaReport: record("submit-report"), loadPlazaThread: record("thread"),
      loadFriends: record("friends"), loadDmConversations: record("dms"),
      openDmConversation: record("dm"), openDmWithPeer: record("peer"),
      ensureSession: record("session"), handleLookupInvite: record("lookup"),
      ...overrides
    }
  };
}

test("lobby navigation loads data before switching view", async () => {
  const { calls, state, options } = setup({ action: "go-lobby" });
  assert.equal(await handlePlaySocialAction(options), true);
  assert.equal(state.view, "lobby");
  assert.deepEqual(calls.map((call) => call[0]), ["rooms", "stream", "render"]);
});

test("invalid lobby invite is handled without lookup", async () => {
  const { calls, options } = setup({ action: "lobby-join" });
  assert.equal(await handlePlaySocialAction(options), true);
  assert.deepEqual(calls.map((call) => call[0]), ["toast"]);
});

test("friend acceptance refreshes friends and releases busy state", async () => {
  const api = { respondFriendRequest: async () => {} };
  const { calls, options } = setup({
    action: "friend-accept",
    button: { dataset: { userId: "user-2" } },
    api
  });
  assert.equal(await handlePlaySocialAction(options), true);
  assert.deepEqual(calls.filter((call) => call[0] === "busy").map((call) => call[1]), [true, false]);
  assert.ok(calls.some((call) => call[0] === "friends"));
});

test("unknown social action remains unhandled", async () => {
  const { options } = setup();
  assert.equal(await handlePlaySocialAction(options), false);
});
