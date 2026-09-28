import assert from "node:assert/strict";
import test from "node:test";
import { createLastLighthouseDesign } from "../shared/last-lighthouse-preset.js";
import { compileBoardGameEngine, createBoardGameRuntimeState, executeBoardGameAction, advanceBoardGameRuntime } from "../shared/board-game-engine.js";

test("last lighthouse preset compiles and runs its core loop", () => {
  const design = createLastLighthouseDesign();
  const report = compileBoardGameEngine(design, 4);
  assert.equal(report.blocking, false);
  assert.equal(report.engine.map.nodes.length, 8);
  assert.equal(report.engine.actions.length, 9);

  let state = createBoardGameRuntimeState(design, 4);
  const move = executeBoardGameAction(design, state, { actionId: "action-sail", targetId: "mist-harbor", seatIndex: 0 });
  assert.equal(move.ok, true);
  state = move.state;
  assert.equal(state.playerValues[0].supply, 3);
  state = executeBoardGameAction(design, state, { actionId: "action-rest-route", targetId: "", seatIndex: 1 }).state;
  state = executeBoardGameAction(design, state, { actionId: "action-rest-route", targetId: "", seatIndex: 2 }).state;
  const resolved = executeBoardGameAction(design, state, { actionId: "action-rest-route", targetId: "", seatIndex: 3 });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.state.playerValues[0].supply, 2);
  state = advanceBoardGameRuntime(design, resolved.state).state;
  assert.equal(state.phaseIndex, 1);

  for (const [phaseIndex, actionId] of [[1, "action-rest-expedition"], [2, "action-rest-build"]]) {
    for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
      state = executeBoardGameAction(design, state, { actionId, targetId: "", seatIndex }).state;
    }
    state = advanceBoardGameRuntime(design, state).state;
    if (phaseIndex === 1) assert.equal(state.phaseIndex, 2);
  }
  assert.equal(state.values.stability, 6);

  state.values.beacons = 7;
  state.resolved = true;
  const lighthouseEnd = advanceBoardGameRuntime(design, state);
  assert.equal(lighthouseEnd.state.ended, true);
});

