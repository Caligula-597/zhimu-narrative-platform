/**
 * Pipeline session model tests — pure logic, no DOM.
 * Usage: node --test scripts/pipeline-wizard-session.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadPipelineSession() {
  const raw = fs.readFileSync(path.join(root, "src/views/pipeline-wizard-session.js"), "utf8");
  const code = raw.replace(/\nexport\s*\{\s*\}\s*;?\s*$/, "");
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.zhimuPipelineSession;
}

test("migrateLegacySession clears narrative downstream into matrix flow", () => {
  const PS = loadPipelineSession();
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

test("pipelineClearDownstream clears truth when setup is edited", () => {
  const PS = loadPipelineSession();
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

test("pipelineDepsLocked requires setup before truth", () => {
  const PS = loadPipelineSession();
  const session = PS.defaultPipelineSession();
  session.locks = { setup: false };
  assert.equal(PS.pipelineDepsLocked(session, "truth"), false);
  session.locks.setup = true;
  assert.equal(PS.pipelineDepsLocked(session, "truth"), true);
});

test("pipelineStepName strips numbered prefix without breaking CJK", () => {
  const PS = loadPipelineSession();
  assert.equal(PS.pipelineStepName("setup"), "创作立项");
  assert.equal(PS.pipelineStepLabel("truth"), "② 真相档案");
  assert.equal(PS.pipelineStepLabel("scripts"), "⑥ 逐幕剧本");
});

test("countMatrixScripts tracks per-cell completion", () => {
  const PS = loadPipelineSession();
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

test("pipelineDepsLocked requires evaluate before sync", () => {
  const PS = loadPipelineSession();
  const session = PS.defaultPipelineSession();
  session.locks = { setup: true, truth: true, characters: true, matrix: true, scripts: true, evaluate: false };
  assert.equal(PS.pipelineDepsLocked(session, "sync"), false);
  session.locks.evaluate = true;
  assert.equal(PS.pipelineDepsLocked(session, "sync"), true);
});

test("normalizeLayerName maps legacy layer ids", () => {
  const PS = loadPipelineSession();
  assert.equal(PS.normalizeLayerName("narrative"), "truth");
  assert.equal(PS.normalizeLayerName("roles"), "scripts");
  assert.equal(PS.normalizeLayerName("structure"), "sync");
});
