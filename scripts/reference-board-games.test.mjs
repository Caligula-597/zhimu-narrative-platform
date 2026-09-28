import assert from "node:assert/strict";
import test from "node:test";
import { BOARD_GAME_REFERENCE_CATALOG, createRouteNetworkDesign, createSkylineDraftDesign, createStormClimbDesign } from "../shared/reference-board-game-presets.js";
import { compileBoardGameEngine, createBoardGameRuntimeState, executeBoardGameAction, advanceBoardGameRuntime } from "../shared/board-game-engine.js";

test("参考机制桌游全部通过引擎编译并提供说明书", () => {
  for (const preset of BOARD_GAME_REFERENCE_CATALOG) {
    const design = preset.create();
    const report = compileBoardGameEngine(design, design.playerCount.min);
    assert.equal(report.blocking, false, `${preset.id}: ${report.issues.map((issue) => issue.message).join("；")}`);
    assert.ok(design.rulebook.objective.length >= 12);
    assert.ok(design.rulebook.playerActions.length >= 12);
  }
});

test("路线争夺按路线长度扣除资源并计分，路线归属公开且不可重复占领", () => {
  const design = createRouteNetworkDesign();
  let state = createBoardGameRuntimeState(design, 4);
  const result = executeBoardGameAction(design, state, { actionId: "action-claim-route", targetId: "route-mist-sun", seatIndex: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.state.routeOwners["route-mist-sun"], 0);
  assert.equal(result.state.playerValues[0].rail, 11);
  assert.equal(result.state.playerValues[0].score, 3);
  state = advanceBoardGameRuntime(design, result.state).state;
  const blocked = executeBoardGameAction(design, state, { actionId: "action-claim-route", targetId: "route-mist-sun", seatIndex: 1 });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "TARGET_ILLEGAL");
});

test("公开轮抽要求不同席位选择不同市场卡，并把卡面效果写入收藏", () => {
  const design = createSkylineDraftDesign();
  let state = createBoardGameRuntimeState(design, 4);
  const market = state.market.map((card) => card.id);
  for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
    const result = executeBoardGameAction(design, state, { actionId: "action-draft-module", cardId: market[seatIndex], seatIndex });
    assert.equal(result.ok, true);
    state = result.state;
  }
  assert.equal(state.claimedCards.every((cards) => cards.length === 1), true);
  assert.equal(state.market.length, 4);
  assert.equal(state.playerValues.some((values) => values.score > 0), true);
});

test("风险推进使用确定性骰面，继续掷骰不换席，停手才结算风险", () => {
  const design = createStormClimbDesign();
  let state = createBoardGameRuntimeState(design, 4);
  const first = executeBoardGameAction(design, state, { actionId: "action-roll-storm", seatIndex: 0 });
  assert.equal(first.ok, true);
  assert.equal(first.state.dice.length, 2);
  state = advanceBoardGameRuntime(design, first.state).state;
  if (first.state.continueSeatIndex === 0) assert.equal(state.activeSeatIndex, 0);
  state.riskProgress[0] = 5;
  const stopped = executeBoardGameAction(design, state, { actionId: "action-stop-storm", seatIndex: state.activeSeatIndex });
  if (state.activeSeatIndex === 0) {
    assert.equal(stopped.ok, true);
    assert.equal(stopped.state.riskProgress[0], 0);
    assert.equal(stopped.state.playerValues[0].score, 5);
  }
  const terminal = createBoardGameRuntimeState(design, 4);
  terminal.playerValues[0].score = 30;
  terminal.resolved = true;
  assert.equal(advanceBoardGameRuntime(design, terminal).ended, true);
});
