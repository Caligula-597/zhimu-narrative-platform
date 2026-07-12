import assert from "node:assert/strict";
import test from "node:test";
import { createPlayerGameController } from "../src/runtime/player-game-controller.js";

function setup(api, overrides = {}) {
  const calls = [];
  const state = { roomId: "room-1", home: { currentActKey: "act-1", sections: [] } };
  const controller = createPlayerGameController({
    api, state, render() {}, setBusy: (value) => calls.push(["busy", value]),
    setToast: (message) => calls.push(["toast", message]),
    formatApiError: (_error, fallback) => fallback,
    pullRoomData: async (options) => calls.push(["refresh", options]),
    patchGameView() {}, patchGameSectionsTab() {}, gamePatchCtx: {},
    coalescedPartialRefresh: async () => {}, openModalState: (modal) => calls.push(["modal", modal]),
    normalizeMiniGame: (game) => game, asArray: (value) => Array.isArray(value) ? value : [],
    documentRef: { querySelector: () => null }, ...overrides
  });
  return { controller, state, calls };
}

test("task completion refreshes partial player data", async () => {
  const { controller, calls } = setup({ completePlayerTask: async () => {} });
  await controller.handleCompletePlayerTask("task-1");
  assert.ok(calls.some((call) => call[0] === "refresh" && call[1].partial));
});

test("empty testimony is rejected before API request", async () => {
  let submitted = false;
  const { controller, calls } = setup(
    { submitTestimony: async () => { submitted = true; } },
    { documentRef: { querySelector: () => ({ value: "   " }) } }
  );
  await controller.handleSubmitTestimony();
  assert.equal(submitted, false);
  assert.deepEqual(calls[0], ["toast", "请填写口供内容"]);
});

test("failed optimistic section completion restores prior state", async () => {
  const section = { id: "section-1", completed: false };
  const { controller, state, calls } = setup({ completeSection: async () => { throw new Error("offline"); } });
  state.home.sections = [section];
  await controller.handleCompleteSection(section.id);
  assert.equal(section.completed, false);
  assert.ok(calls.some((call) => call[0] === "toast" && call[1] === "操作失败"));
});
