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

test("communication action rejects missing authored template content without API write", async () => {
  const { calls, options } = setup({
    action: "submit-private-action",
    api: { createPrivateAction: async () => { throw new Error("must not run"); } }
  });
  assert.equal(await handlePlayGameAction(options), true);
  assert.deepEqual(calls[0].slice(0, 2), ["toast", "请填写提交内容"]);
});

test("vote without complete identity is handled without API request", async () => {
  const { calls, options } = setup({ action: "submit-vote-ballot" });
  assert.equal(await handlePlayGameAction(options), true);
  assert.deepEqual(calls, []);
});

test("structured mechanism sessions submit opaque ranking and exact allocations", async () => {
  let sent = null;
  const rankingRows = ["option-2", "option-1"].map((optionKey) => ({
    dataset: { optionKey },
  }));
  const rankingPanel = {
    dataset: { decisionKey: "choice-1" },
    querySelectorAll: () => rankingRows,
  };
  const ranking = setup({
    action: "submit-mechanism-ranking",
    button: { closest: () => rankingPanel, dataset: {} },
    state: {
      roomId: "room-1",
      home: { currentState: { mechanism: { revision: 7 } } },
    },
    api: {
      async submitMechanismDecision(_roomId, _decisionKey, payload) {
        sent = payload;
      },
    },
  });
  await handlePlayGameAction(ranking.options);
  assert.deepEqual(sent.answer, {
    type: "ranking",
    optionKeys: ["option-2", "option-1"],
  });

  const allocationRows = [
    { key: "option-1", amount: "40" },
    { key: "option-2", amount: "60" },
  ].map((entry) => ({
    dataset: { optionKey: entry.key },
    querySelector: () => ({ value: entry.amount }),
  }));
  const allocationPanel = {
    dataset: { decisionKey: "choice-2", allocationTotal: "100" },
    querySelectorAll: () => allocationRows,
  };
  const allocation = setup({
    action: "submit-mechanism-allocation",
    button: { closest: () => allocationPanel, dataset: {} },
    state: ranking.options.state,
    api: {
      async submitMechanismDecision(_roomId, _decisionKey, payload) {
        sent = payload;
      },
    },
  });
  await handlePlayGameAction(allocation.options);
  assert.equal(sent.answer.type, "allocation");
  assert.equal(
    sent.answer.allocations.reduce((sum, entry) => sum + entry.amount, 0),
    100,
  );
});

test("unknown game action remains unhandled", async () => {
  const { options } = setup();
  assert.equal(await handlePlayGameAction(options), false);
});
