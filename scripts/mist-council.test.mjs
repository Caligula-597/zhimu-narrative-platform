import assert from "node:assert/strict";
import test from "node:test";
import { compileBoardGameEngine, createBoardGameRuntimeState, executeBoardGameAction } from "../shared/board-game-engine.js";
import { createMistCouncilDesign } from "../shared/mist-council-preset.js";

function submit(design, state, seatIndex, actionId) {
  return executeBoardGameAction(design, state, { actionId, targetId: "", seatIndex });
}

test("雾中议会预设拥有完整说明书并可运行", () => {
  const design = createMistCouncilDesign();
  const fields = ["objective", "setup", "turnStructure", "playerActions", "endCondition", "tieBreak", "notes"];
  assert.ok(fields.every((field) => design.rulebook[field].length > 0));
  const report = compileBoardGameEngine(design, 4);
  assert.equal(report.blocking, false);
  assert.equal(report.capabilities.partial, 0);
  assert.equal(report.capabilities.unsupported, 0);
});

test("公开表决在全部提交后统一统计，支持者获得个人声望", () => {
  const design = createMistCouncilDesign();
  const initial = createBoardGameRuntimeState(design, 4);
  const first = submit(design, initial, 0, "action-support");
  const second = submit(design, first.state, 1, "action-support");
  const third = submit(design, second.state, 2, "action-oppose");
  const fourth = submit(design, third.state, 3, "action-oppose");
  assert.equal(fourth.ok, true);
  assert.equal(fourth.phaseResolved, true);
  assert.equal(fourth.state.values.laws, 0);
  assert.equal(fourth.state.values.stability, 5);
  assert.equal(fourth.state.playerValues[2].score, 1);
  assert.equal(fourth.state.playerValues[3].influence, 1);
  assert.match(fourth.state.log[0].text, /支持 2、反对 2；法案否决/);
});
