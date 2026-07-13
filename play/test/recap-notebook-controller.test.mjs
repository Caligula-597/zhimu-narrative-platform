import assert from "node:assert/strict";
import test from "node:test";
import { createRecapNotebookController } from "../src/runtime/recap-notebook-controller.js";

function setup(api, stateOverrides = {}) {
  const state = { roomId: "room-1", tab: "home", ...stateOverrides };
  const toasts = [];
  let partialRefreshes = 0;
  const controller = createRecapNotebookController({
    api, state, render() {}, setBusy() {},
    setToast(message) { toasts.push(message); },
    formatApiError: (_error, fallback) => fallback,
    pullRoomData: async (options) => {
      assert.deepEqual(options, { partial: true });
      partialRefreshes += 1;
    }
  });
  return { controller, state, toasts, partialRefreshes: () => partialRefreshes };
}

test("missing recap is represented as an empty state instead of an error", async () => {
  const error = new Error("missing");
  error.code = "RECAP_NOT_GENERATED";
  const { controller, state } = setup({ latestRecap: async () => { throw error; } });
  await controller.loadRecapSummary();
  assert.equal(state.recapLatest, null);
  assert.equal(state.recapError, "");
});

test("notebook write trims input and performs one partial refresh", async () => {
  let payload;
  const { controller, state, partialRefreshes } = setup({
    addNotebookEntry: async (_roomId, value) => { payload = value; }
  }, { notesDraftTitle: "  标题 ", notesDraft: " 正文  " });
  await controller.handleAddNotebookEntry();
  assert.equal(payload.title, "标题");
  assert.equal(payload.body, "正文");
  assert.equal(partialRefreshes(), 1);
  assert.equal(state.notesDraft, "");
});

test("empty notebook entry never reaches the API", async () => {
  let writes = 0;
  const { controller, toasts } = setup({
    addNotebookEntry: async () => { writes += 1; }
  }, { notesDraftTitle: "", notesDraft: "正文" });
  await controller.handleAddNotebookEntry();
  assert.equal(writes, 0);
  assert.ok(toasts.length > 0);
});
