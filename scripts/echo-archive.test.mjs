import assert from "node:assert/strict";
import test from "node:test";
import { compileBoardGameEngine, createBoardGameRuntimeState, executeBoardGameAction } from "../shared/board-game-engine.js";
import { createEchoArchiveDesign } from "../shared/echo-archive-preset.js";

test("回声档案馆预设支持抽牌、打牌和条件拼接", () => {
  const design = createEchoArchiveDesign();
  const report = compileBoardGameEngine(design, 4);
  assert.equal(report.blocking, false);
  assert.equal(report.capabilities.partial, 0);
  assert.equal(report.capabilities.unsupported, 0);
});

test("抽牌消耗公共牌库，打牌推进证据；高价值拼接需要先有证据", () => {
  const design = createEchoArchiveDesign();
  const initial = createBoardGameRuntimeState(design, 4);
  const draw = executeBoardGameAction(design, initial, { actionId: "action-draw", targetId: "", seatIndex: 0 });
  assert.equal(draw.ok, true);
  assert.equal(draw.state.values.deck, 23);
  assert.equal(draw.state.playerValues[0].hand, 1);
  assert.equal(draw.state.hands[0].length, 1);
  assert.match(draw.state.hands[0][0].id, /^component-clue-deck:/);
  const blockedState = structuredClone(initial);
  blockedState.playerValues[0].hand = 1;
  blockedState.hands[0].push(blockedState.decks["component-clue-deck"].pop());
  const blocked = executeBoardGameAction(design, blockedState, { actionId: "action-connection", targetId: "", seatIndex: 0 });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "MECHANISM_CONDITION_BLOCKED");
  const clueState = structuredClone(initial);
  clueState.playerValues[0].hand = 1;
  const selectedCard = clueState.decks["component-clue-deck"].pop();
  clueState.hands[0].push(selectedCard);
  const clue = executeBoardGameAction(design, clueState, { actionId: "action-clue", targetId: "", seatIndex: 0, cardId: selectedCard.id });
  assert.equal(clue.ok, true);
  assert.equal(clue.state.playerValues[0].hand, 0);
  assert.equal(clue.state.hands[0].length, 0);
  assert.equal(clue.state.playerValues[0].evidence, 1);
  assert.equal(clue.state.values.truth, 1);
});
