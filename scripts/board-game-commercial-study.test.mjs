import test from "node:test";
import assert from "node:assert/strict";
import { COMMERCIAL_STUDY_CATALOG, createCommercialStudyPreset } from "../shared/commercial-study-presets.js";
import { COMMERCIAL_GAME_LIBRARY } from "../shared/commercial-game-library.js";
import { normalizeBoardGameDesign } from "../shared/board-game-design.js";
import { compileBoardGameEngine } from "../shared/board-game-engine.js";
import { createBoardGamePortingReport } from "../shared/board-game-porting-contract.js";

test("商业机制研究库的每个可玩适配都带来源、边界和完整说明书", () => {
  assert.equal(COMMERCIAL_STUDY_CATALOG.length, 7);
  assert.deepEqual(
    COMMERCIAL_GAME_LIBRARY.map((item) => item.id),
    COMMERCIAL_STUDY_CATALOG.map((item) => item.id),
    "玩家库与创作端研究库必须一一对应"
  );
  const ids = new Set();
  for (const preset of COMMERCIAL_STUDY_CATALOG) {
    assert.ok(!ids.has(preset.id), `重复研究条目 ${preset.id}`);
    ids.add(preset.id);
    assert.ok(preset.sourceGame);
    assert.ok(preset.family);
    assert.equal(preset.status, "runnable_adapter");
    assert.ok(preset.coreMechanisms.length >= 3);
    assert.match(preset.summary, /研究/);
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
