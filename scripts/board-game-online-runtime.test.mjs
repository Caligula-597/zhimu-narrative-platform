import assert from "node:assert/strict";
import test from "node:test";
import { createBoardGameRuntimeState } from "../shared/board-game-engine.js";
import { createRuinsAuctionDesign } from "../shared/ruins-auction-preset.js";
import { createEchoArchiveDesign } from "../shared/echo-archive-preset.js";
import { createSkylineDraftDesign } from "../shared/reference-board-game-presets.js";
import {
  applyBoardGameOnlineCommand,
  createBoardGameDeadline,
  createBoardGameOnlineCommand,
  createBoardGameOnlineSnapshot
} from "../shared/board-game-online-runtime.js";

test("同一种子生成的牌堆顺序可复现，线上快照隐藏对手手牌内容", () => {
  const design = createEchoArchiveDesign();
  const left = createBoardGameRuntimeState(design, 4);
  const right = createBoardGameRuntimeState(design, 4);
  assert.deepEqual(left.decks["component-clue-deck"], right.decks["component-clue-deck"]);
  left.hands[0].push(left.decks["component-clue-deck"].pop());
  left.hands[1].push(left.decks["component-clue-deck"].pop());
  const snapshot = createBoardGameOnlineSnapshot(design, left, { deadline: createBoardGameDeadline(1000, 15) });
  assert.deepEqual(snapshot.publicState.hands[0], { count: 1 });
  assert.equal(typeof snapshot.publicState.decks["component-clue-deck"].count, "number");
  assert.equal(Array.isArray(snapshot.publicState.decks["component-clue-deck"]), false);
  assert.equal(snapshot.viewerStates[0].viewer.hand.length, 1);
  assert.equal(snapshot.viewerStates[1].viewer.hand.length, 1);
  assert.equal(snapshot.deadline.deadlineAt, 16000);
});

test("线上效果响应遵守公开与席位私有边界", () => {
  const design = createEchoArchiveDesign();
  const state = createBoardGameRuntimeState(design, 2);
  state.responseEvents = [
    { id: "public-response", visibility: "public", sourceLabel: "公开结算", seatIndex: 0, targetSeatIndex: null },
    { id: "private-response", visibility: "private", sourceLabel: "席位一手牌", seatIndex: 0, targetSeatIndex: 0 },
    { id: "other-private-response", visibility: "private", sourceLabel: "席位二手牌", seatIndex: 1, targetSeatIndex: 1 }
  ];
  const snapshot = createBoardGameOnlineSnapshot(design, state);
  assert.deepEqual(snapshot.publicState.responseEvents.map((event) => event.id), ["public-response"]);
  assert.deepEqual(snapshot.viewerStates[0].responseEvents.map((event) => event.id), ["public-response", "private-response"]);
  assert.deepEqual(snapshot.viewerStates[1].responseEvents.map((event) => event.id), ["public-response", "other-private-response"]);
});

test("线上命令按版本签名执行并具备幂等重放", () => {
  const design = createRuinsAuctionDesign();
  const initial = createBoardGameRuntimeState(design, 4);
  const command = createBoardGameOnlineCommand(design, { commandId: "cmd-1", clientSequence: 1, seatIndex: 0, actionId: "action-bid", bidAmount: 3 });
  const applied = applyBoardGameOnlineCommand(design, initial, command, { serverNow: 1000 });
  assert.equal(applied.ok, true);
  assert.equal(applied.state.online.revision, 1);
  const duplicate = applyBoardGameOnlineCommand(design, applied.state, command, { serverNow: 1100 });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.state, applied.state);
  const stale = applyBoardGameOnlineCommand(design, initial, { ...command, commandId: "cmd-stale", designSignature: "old-design" });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "DESIGN_SIGNATURE_MISMATCH");
});

test("线上权威入口拒绝过期阶段的命令", () => {
  const design = createRuinsAuctionDesign();
  const state = createBoardGameRuntimeState(design, 4);
  const command = createBoardGameOnlineCommand(design, {
    commandId: "cmd-expired",
    clientSequence: 1,
    seatIndex: 0,
    actionId: "action-bid",
    bidAmount: 1
  });
  const result = applyBoardGameOnlineCommand(design, state, command, {
    serverNow: 2001,
    deadline: createBoardGameDeadline(1000, 1)
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "DEADLINE_EXPIRED");
});

test("公开轮抽快照向玩家提供市场卡与并行阶段元数据", () => {
  const design = createSkylineDraftDesign();
  const state = createBoardGameRuntimeState(design, 4);
  const snapshot = createBoardGameOnlineSnapshot(design, state);
  assert.equal(snapshot.catalog.phases[0].mode, "reveal");
  assert.match(snapshot.catalog.phases[0].description, /同时/);
  assert.equal(snapshot.catalog.actions[0].draftMode, "public_market");
  assert.equal(snapshot.publicState.market.length, 4);
  assert.equal(snapshot.viewerStates[0].viewer.hand.length, 0);
});
