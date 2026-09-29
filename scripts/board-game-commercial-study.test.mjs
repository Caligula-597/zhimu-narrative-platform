import test from "node:test";
import assert from "node:assert/strict";
import { COMMERCIAL_STUDY_CATALOG, createCommercialStudyPreset } from "../shared/commercial-study-presets.js";
import { COMMERCIAL_GAME_LIBRARY } from "../shared/commercial-game-library.js";
import { normalizeBoardGameDesign } from "../shared/board-game-design.js";
import { compileBoardGameEngine } from "../shared/board-game-engine.js";
import { createBoardGamePortingReport } from "../shared/board-game-porting-contract.js";

test("商业机制研究库的每个可玩适配都带来源、边界和完整说明书", () => {
  assert.equal(COMMERCIAL_STUDY_CATALOG.length, 12);
  const production = COMMERCIAL_STUDY_CATALOG.filter((item) => item.status === "production_ready");
  assert.equal(production.length, 5);
  assert.deepEqual(
    COMMERCIAL_GAME_LIBRARY.map((item) => item.id),
    production.map((item) => item.id),
    "玩家库只展示已经通过首发验收的条目"
  );
  const ids = new Set();
  for (const preset of COMMERCIAL_STUDY_CATALOG) {
    assert.ok(!ids.has(preset.id), `重复研究条目 ${preset.id}`);
    ids.add(preset.id);
    assert.ok(preset.sourceGame);
    assert.ok(preset.family);
    assert.ok(["runnable_adapter", "production_ready"].includes(preset.status));
    assert.ok(preset.coreMechanisms.length >= 3);
    assert.ok(preset.summary.includes("研究") || preset.status === "production_ready");
    const design = createCommercialStudyPreset(preset.id);
    assert.equal(design.commercialStudy.studyId, preset.id);
    assert.equal(normalizeBoardGameDesign(design).commercialStudy.studyId, preset.id, `${preset.id} 元数据未被规范化层保留`);
    assert.equal(design.commercialStudy.sourceGame, preset.sourceGame);
    assert.match(design.commercialStudy.adaptationBoundary, /原创适配/);
    for (const field of ["objective", "setup", "turnStructure", "playerActions", "endCondition", "tieBreak", "notes"]) {
      assert.ok(String(design.rulebook[field] || "").length >= 12, `${preset.id} 缺少说明书字段 ${field}`);
    }
  }
});

test("首发五款桌游具备逐项内容清单并锁定生产状态", () => {
  for (const preset of COMMERCIAL_STUDY_CATALOG.filter((item) => item.status === "production_ready")) {
    const design = createCommercialStudyPreset(preset.id);
    assert.equal(design.commercialStudy.releaseTier, "production");
    assert.equal(design.commercialStudy.acceptanceChecklist.length, 5, `${preset.id} 缺少五项首发验收清单`);
    assert.ok(design.components.length >= 1);
    assert.ok(design.seats.length >= design.playerCount.min);
    assert.ok(design.engine.phases.every((phase) => phase.actionIds.length > 0));
    assert.ok(design.engine.actions.every((action) => action.description.length >= 12));
  }
});

test("商业机制研究库的每个可玩适配都能通过引擎和线上承载验收", () => {
  for (const preset of COMMERCIAL_STUDY_CATALOG) {
    const design = createCommercialStudyPreset(preset.id);
    const compile = compileBoardGameEngine(design, design.playerCount.min);
    assert.deepEqual(compile.issues.filter((item) => item.level === "error"), [], `${preset.id} 引擎编译失败`);
    const report = createBoardGamePortingReport(design, { designId: preset.id });
    assert.equal(report.status, "complete", `${preset.id}: ${report.omissions.join("；")}`);
    assert.equal(report.coverage.executableDecks, report.coverage.decks);
  }
});
