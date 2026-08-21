import assert from "node:assert/strict";
import test from "node:test";

globalThis.localStorage = {
  getItem() { return ""; },
  setItem() {},
  removeItem() {},
};

const { state } = await import("../src/state.js");
const { renderConclusionStatus } = await import("../src/views/game-shell-view.js");

test("player conclusion status distinguishes durable pending and ready states", () => {
  state.sessionConclusion = { status: "recap_pending", endingId: "escape", revision: 2 };
  assert.match(renderConclusionStatus(), /复盘准备中/);
  assert.match(renderConclusionStatus(), /网络中断/);
  assert.doesNotMatch(renderConclusionStatus(), /查看复盘/);

  state.sessionConclusion = { status: "ready", endingId: "escape", recapId: "recap-1", revision: 3 };
  assert.match(renderConclusionStatus(), /本局复盘已就绪/);
  assert.match(renderConclusionStatus(), /data-tab="recap"/);
  state.sessionConclusion = null;
});
