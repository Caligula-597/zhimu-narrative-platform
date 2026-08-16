/**
 * Pipeline session model tests — pure logic, no DOM.
 * Usage: node --test scripts/pipeline-wizard-session.test.mjs
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let importSequence = 0;
async function loadPipelineSession() {
  globalThis.window = {};
  importSequence += 1;
  await import(`${pathToFileURL(path.join(root, "src/views/pipeline-wizard-session.js")).href}?test=${importSequence}`);
  return globalThis.window.zhimuPipelineSession;
}

test("migrateLegacySession clears narrative downstream into matrix flow", async () => {
  const PS = await loadPipelineSession();
  const session = PS.normalizePipelineSession({
    setting: { theme: "测试", playerCount: 4, chapterCount: 1, volumeTier: "standard" },
    synopsis: { body: "纲要" },
    config: { playerCount: 4, chapterKeys: ["ch1"] },
    narrativeChapters: { ch1: { chapterKey: "ch1", narrativeBody: "x".repeat(4000) } },
    rolesMeta: { roles: [{ key: "a", name: "A" }] },
    sections: { a: { ch1: { body: "x".repeat(260) } } },
    proposal: { chapters: [{ key: "ch1", title: "T" }] },
    locks: { setup: true, narrative: true, roles: true }
  });
  assert.equal(Object.keys(session.scripts).length, 0);
  assert.equal(session.truthBible, null);
  assert.equal(session.characterArchives, null);
  assert.equal(session.activeLayer, "setup");
});

test("pipelineClearDownstream clears truth when setup is edited", async () => {
  const PS = await loadPipelineSession();
  const session = PS.normalizePipelineSession({
    setting: { theme: "测试", playerCount: 4, chapterCount: 1 },
    synopsis: { body: "纲要" },
    config: { playerCount: 4, chapterKeys: ["ch1"] },
    truthBible: { summary: "x".repeat(220), killer: "甲", method: "毒" },
    locks: { setup: true, truth: true }
  });
  PS.pipelineClearDownstream(session, "setup");
  assert.equal(session.truthBible, null);
  assert.equal(session.locks.truth, false);
});

test("pipelineDepsLocked requires setup before truth", async () => {
  const PS = await loadPipelineSession();
  const session = PS.defaultPipelineSession();
  session.locks = { setup: false };
  assert.equal(PS.pipelineDepsLocked(session, "truth"), false);
  session.locks.setup = true;
  assert.equal(PS.pipelineDepsLocked(session, "truth"), true);
});

test("pipelineStepName strips numbered prefix without breaking CJK", async () => {
  const PS = await loadPipelineSession();
  assert.equal(PS.pipelineStepName("setup"), "创作立项");
  assert.equal(PS.pipelineStepLabel("truth"), "② 世界与真相合同");
  assert.equal(PS.pipelineStepLabel("clues"), "④ 稀疏线索网络");
  assert.equal(PS.pipelineStepLabel("scripts"), "⑦ 逐幕剧本");
});

test("countMatrixScripts tracks per-cell completion", async () => {
  const PS = await loadPipelineSession();
  const session = PS.normalizePipelineSession({
    setting: { theme: "测试", volumeTier: "demo" },
    config: { playerCount: 2, chapterKeys: ["act1", "act2"] },
    characterArchives: { roles: [{ key: "r1", name: "甲" }, { key: "r2", name: "乙" }] },
    scripts: { r1: { act1: { body: "x".repeat(500) } } }
  });
  const progress = PS.countMatrixScripts(session);
  assert.equal(progress.total, 4);
  assert.equal(progress.done, 1);
  assert.equal(progress.min, 400);
});

test("pipelineDepsLocked requires evaluate before sync", async () => {
  const PS = await loadPipelineSession();
  const session = PS.defaultPipelineSession();
  session.locks = { setup: true, truth: true, characters: true, clues: true, matrix: true, host: true, scripts: true, evaluate: false };
  assert.equal(PS.pipelineDepsLocked(session, "sync"), false);
  session.locks.evaluate = true;
  assert.equal(PS.pipelineDepsLocked(session, "sync"), true);
});

test("normalizeLayerName maps legacy layer ids", async () => {
  const PS = await loadPipelineSession();
  assert.equal(PS.normalizeLayerName("narrative"), "truth");
  assert.equal(PS.normalizeLayerName("roles"), "scripts");
  assert.equal(PS.normalizeLayerName("structure"), "sync");
});

test("repair plan unlocks only the failed layer and declared dependents", async () => {
  const PS = await loadPipelineSession();
  const session = PS.defaultPipelineSession();
  session.locks = Object.fromEntries(PS.PIPELINE_LAYER_ORDER.map((layer) => [layer, true]));
  session.evaluation = {
    repairPlan: {
      earliestStage: "scripts",
      items: [{ targetStage: "scripts", invalidates: ["scripts", "evaluation"] }]
    }
  };
  const result = PS.applyPipelineRepairPlan(session);
  assert.equal(result.targetLayer, "scripts");
  assert.equal(session.activeLayer, "scripts");
  assert.equal(session.locks.scripts, false);
  assert.equal(session.locks.evaluate, false);
  assert.equal(session.locks.sync, false);
  assert.equal(session.locks.truth, true);
  assert.equal(session.locks.host, true);
});

test("daily player-script payload explicitly selects scene-first structured generation", async () => {
  const PS = await loadPipelineSession();
  const payload = PS.pipelinePayload(PS.defaultPipelineSession());
  assert.equal(payload.scriptGenerationMode, "structured");
});

test("faction truth layer is complete without a killer when main endings and role epilogues exist", async () => {
  const PS = await loadPipelineSession();
  const session = PS.defaultPipelineSession();
  session.setting = { playStructure: "faction" };
  session.config = { playerCount: 2, chapterKeys: ["ch1"] };
  session.truthBible = {
    summary: "x".repeat(220), centralQuestion: "谁承担？", publicCrisis: "必须结算", irreversibleDeadline: "零点",
    playerExperiencePromise: "亲手拼回证据并在互相需要时决定是否交换。",
    retellableMoment: "两个人各握半张纸，却发现拼上以后会同时暴露自己。",
    worldSpecificActions: [{ action: "拼纸" }, { action: "封存" }],
    sharedObjective: "先恢复被打乱的记录。",
    truthNodes: [
      { key: "t1", importance: "critical" }, { key: "t2", importance: "supporting" },
      { key: "t3", importance: "local" }, { key: "t4", importance: "supporting" }
    ],
    endingAxes: [{ key: "a" }, { key: "b" }],
    roleEpilogues: [
      { roleKey: "role-1", variants: [{ key: "r1-a" }, { key: "r1-b" }] },
      { roleKey: "role-2", variants: [{ key: "r2-a" }, { key: "r2-b" }] }
    ]
  };
  assert.equal(PS.pipelineLayerHasData(session, "truth"), true);
});

test("field repair marks exact stale artifacts without deleting unrelated drafts", async () => {
  const PS = await loadPipelineSession();
  const session = PS.defaultPipelineSession();
  session.scripts = {
    "role-1": { ch1: { body: "甲".repeat(500) } },
    "role-2": { ch1: { body: "乙".repeat(500) } }
  };
  session.locks = Object.fromEntries(PS.PIPELINE_LAYER_ORDER.map((layer) => [layer, true]));
  session.evaluation = {
    repairPlan: {
      earliestStage: "scripts",
      items: [{
        key: "role-1_ch1",
        targetStage: "scripts",
        targetPaths: ["scripts.cells.role-1.ch1"],
        invalidates: ["scripts", "evaluation"],
        invalidatesPaths: ["scripts.cells.role-1.ch1"],
        problem: "人称漂移"
      }]
    }
  };
  PS.applyPipelineRepairPlan(session);
  assert.equal(session.staleArtifacts["scripts.cells.role-1.ch1"].target, true);
  assert.equal(session.scripts["role-2"].ch1.body.length, 500);
  PS.markPipelineHumanEdit(session, "scripts.cells.role-1.ch1");
  assert.equal(Object.keys(session.staleArtifacts).length, 0);
  assert.equal(session.generationProvenance.records["scripts.cells.role-1.ch1"].originKind, "human_edited");
});
