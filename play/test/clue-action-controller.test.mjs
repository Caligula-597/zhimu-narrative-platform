import assert from "node:assert/strict";
import test from "node:test";
import { handlePlayClueAction } from "../src/runtime/clue-action-controller.js";

function setup(overrides = {}) {
  const calls = [];
  const record = (name) => async (...args) => calls.push([name, ...args]);
  const state = { roomId: "room-1", home: { clues: [{ id: "c1", name: "钥匙", shared_with_room: false }] } };
  return {
    calls, state,
    options: {
      action: "unknown", button: { dataset: {} }, state, api: {}, render() {},
      setBusy: record("busy"), setToast: record("toast"),
      formatApiError: (_error, fallback) => fallback,
      openModalState: record("modal"), closeModalState: record("close"),
      pullRoomData: record("refresh"), ...overrides
    }
  };
}

test("editing an owned clue opens the note modal", async () => {
  const { calls, options } = setup({ action: "edit-clue-note", button: { dataset: { clueId: "c1" } } });
  assert.equal(await handlePlayClueAction(options), true);
  assert.equal(calls[0][0], "modal");
  assert.equal(calls[0][1].kind, "clue-note");
});

test("missing clue produces a user-facing message", async () => {
  const { calls, options } = setup({ action: "share-clue-room", button: { dataset: { clueId: "missing" } } });
  assert.equal(await handlePlayClueAction(options), true);
  assert.deepEqual(calls[0].slice(0, 2), ["toast", "线索不存在"]);
});

test("room sharing toggles visibility and refreshes room data", async () => {
  const api = { shareClueToRoom: async () => {} };
  const { calls, state, options } = setup({
    action: "share-clue-room", button: { dataset: { clueId: "c1" } }, api
  });
  await handlePlayClueAction(options);
  assert.equal(state.clueId, "c1");
  assert.ok(calls.some((call) => call[0] === "refresh"));
});

test("unknown clue action remains unhandled", async () => {
  const { options } = setup();
  assert.equal(await handlePlayClueAction(options), false);
});
