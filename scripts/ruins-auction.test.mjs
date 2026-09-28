import assert from "node:assert/strict";
import test from "node:test";
import {
  compileBoardGameEngine,
  createBoardGameRuntimeState,
  executeBoardGameAction
} from "../shared/board-game-engine.js";
import { createRuinsAuctionDesign } from "../shared/ruins-auction-preset.js";

test("遗迹拍卖所预设完整编译且竞价能力已支持", () => {
  const design = createRuinsAuctionDesign();
  const report = compileBoardGameEngine(design, 4);
  assert.equal(report.blocking, false);
  assert.equal(report.capabilities.partial, 0);
  assert.equal(report.capabilities.unsupported, 0);
});

test("密封竞价等待全部席位后公开，赢家支付并获得遗物奖励", () => {
  const design = createRuinsAuctionDesign();
  const initial = createBoardGameRuntimeState(design, 4);
  const first = executeBoardGameAction(design, initial, { actionId: "action-bid", targetId: "", seatIndex: 0, bidAmount: 3 });
  const second = executeBoardGameAction(design, first.state, { actionId: "action-bid", targetId: "", seatIndex: 1, bidAmount: 6 });
  const third = executeBoardGameAction(design, second.state, { actionId: "action-pass", targetId: "", seatIndex: 2 });
  const fourth = executeBoardGameAction(design, third.state, { actionId: "action-bid", targetId: "", seatIndex: 3, bidAmount: 4 });
  assert.equal(fourth.ok, true);
  assert.equal(fourth.phaseResolved, true);
  assert.equal(fourth.state.values.lot, 1);
  assert.equal(fourth.state.playerValues[1].coins, 6);
  assert.equal(fourth.state.playerValues[1].score, 4);
  assert.equal(fourth.state.playerValues[0].coins, 12);
  assert.match(fourth.state.log[0].text, /席位 2 以 6 赢得本轮遗物/);
});

test("竞价不能超过席位当前金币", () => {
  const design = createRuinsAuctionDesign();
  const state = createBoardGameRuntimeState(design, 4);
  const result = executeBoardGameAction(design, state, { actionId: "action-bid", targetId: "", seatIndex: 0, bidAmount: 13 });
  assert.equal(result.ok, false);
  assert.equal(result.code, "BID_TOO_HIGH");
});
