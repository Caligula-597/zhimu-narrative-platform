import assert from "node:assert/strict";
import test from "node:test";
import { compileBoardGameEngine, createBoardGameRuntimeState, executeBoardGameAction, legalBoardGameTargets } from "../shared/board-game-engine.js";
import { createSeasonWorkshopDesign } from "../shared/season-workshop-preset.js";

test("四季工坊预设编译，工位目标只开放对应空置地形", () => {
  const design = createSeasonWorkshopDesign();
  const report = compileBoardGameEngine(design, 4);
  assert.equal(report.blocking, false);
  const state = createBoardGameRuntimeState(design, 4);
  assert.deepEqual(legalBoardGameTargets(design, state, "place-wood", 0), ["wood-yard", "wood-yard-2"]);
  assert.deepEqual(legalBoardGameTargets(design, state, "place-forge", 0), ["forge"]);
});

test("工人放置执行生产链并拒绝没有原料的熔炉", () => {
  const design = createSeasonWorkshopDesign();
  const initial = createBoardGameRuntimeState(design, 4);
  const blocked = executeBoardGameAction(design, initial, { actionId: "place-forge", targetId: "forge", seatIndex: 0 });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "MECHANISM_CONDITION_BLOCKED");
  const wood = executeBoardGameAction(design, initial, { actionId: "place-wood", targetId: "wood-yard", seatIndex: 0 });
  assert.equal(wood.ok, true);
  assert.equal(wood.state.playerValues[0].wood, 2);
});
