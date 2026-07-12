import assert from "node:assert/strict";
import test from "node:test";
import { handlePlayGameAction } from "../src/runtime/game-action-controller.js";

function setup(overrides = {}) {
  const calls = [];
  const record = (name) => async (...args) => calls.push([name, ...args]);
  const state = { roomId: "room-1" };
  return {
    calls,
    options: {
      action: "unknown", button: { dataset: {} }, state, api: {}, render() {},
      setToast: record("toast"), formatApiError: (_error, fallback) => fallback,
      pullRoomData: record("refresh"), handleCompleteSection: record("section"),
      handleCompletePlayerTask: record("task"), handleSubmitTestimony: record("testimony"),
      handleSubmitSatisfaction: record("satisfaction"), handleReadClue: record("clue"),
      handleInvestigate: record("investigate"), handleMiniGameSubmit: record("game"),
      documentRef: { querySelector: () => null }, ...overrides
    }
  };
}

test("game action delegates section and investigation identities", async () => {
  const first = setup({ action: "complete-section", button: { dataset: { sectionId: "s1" } } });
  assert.equal(await handlePlayGameAction(first.options), true);
  assert.deepEqual(first.calls[0], ["section", "s1"]);

  const second = setup({ action: "investigate", button: { dataset: { pointId: "p1" } } });
  await handlePlayGameAction(second.options);
  assert.deepEqual(second.calls[0], ["investigate", "p1"]);
});

test("private action rejects an empty title without API write", async () => {
  const { calls, options } = setup({
    action: "submit-private-action",
    api: { createPrivateAction: async () => { throw new Error("must not run"); } }
  });
  assert.equal(await handlePlayGameAction(options), true);
  assert.deepEqual(calls[0].slice(0, 2), ["toast", "请填写标题"]);
});

test("vote without complete identity is handled without API request", async () => {
  const { calls, options } = setup({ action: "submit-vote-ballot" });
  assert.equal(await handlePlayGameAction(options), true);
  assert.deepEqual(calls, []);
});

test("unknown game action remains unhandled", async () => {
  const { options } = setup();
  assert.equal(await handlePlayGameAction(options), false);
});
