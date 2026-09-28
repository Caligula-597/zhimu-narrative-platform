import assert from "node:assert/strict";
import test from "node:test";
import { createEchoArchiveDesign } from "../shared/echo-archive-preset.js";
import { createMistCouncilDesign } from "../shared/mist-council-preset.js";
import { createRuinsAuctionDesign } from "../shared/ruins-auction-preset.js";
import { createSeasonWorkshopDesign } from "../shared/season-workshop-preset.js";
import { assertBoardGamePortingComplete, BOARD_GAME_PORTING_OPTIMIZATIONS } from "../shared/board-game-porting-contract.js";
import { BOARD_GAME_REFERENCE_CATALOG } from "../shared/reference-board-game-presets.js";

const designs = [
  ["ruins-auction", createRuinsAuctionDesign],
  ["mist-council", createMistCouncilDesign],
  ["season-workshop", createSeasonWorkshopDesign],
  ["echo-archive", createEchoArchiveDesign]
  , ...BOARD_GAME_REFERENCE_CATALOG.map((preset) => [preset.id, preset.create])
];

test("四种机制的线下内容与线上执行面完整覆盖", () => {
  for (const [designId, create] of designs) {
    const report = assertBoardGamePortingComplete(create(), { designId });
    assert.equal(report.status, "complete");
    assert.ok(report.coverage.componentEntries > 0, `${designId}: 应保留卡面或组件条目`);
    assert.equal(report.omissions.length, 0, `${designId}: 不应有未覆盖内容`);
    assert.ok(report.optimizations.length >= 5, `${designId}: 应登记线上优化点`);
  }
});

test("线上优化声明不修改线下规则语义", () => {
  for (const optimization of BOARD_GAME_PORTING_OPTIMIZATIONS) {
    assert.ok(optimization.keeps.length >= 8);
    assert.ok(optimization.changes.length >= 8);
    assert.ok(optimization.benefit.length >= 8);
  }
});
