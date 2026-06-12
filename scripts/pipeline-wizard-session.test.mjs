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

test("normalizePipelineSession infers locks from nested content", () => {
  const PS = loadPipelineSession();
  const session = PS.normalizePipelineSession({
    spec: { playerCount: 4, chapterKeys: ["ch1"] },
    outline: { logline: "test" },
    narrativeChapters: { ch1: { chapterKey: "ch1", narrativeBody: "x".repeat(500) } },
    roleMatrix: { roles: [{ key: "a", name: "A" }] },
    sections: { a: { ch1: { body: "x".repeat(260) } } },
    proposal: { chapters: [{ key: "ch1", title: "T" }] }
  });
  assert.equal(session.locks.spec, true);
  assert.equal(session.locks.outline, true);
  assert.equal(session.locks.narrative, true);
  assert.equal(session.locks.matrix, true);
});

test("pipelineClearDownstream clears outline when spec is edited", () => {
  const PS = loadPipelineSession();
  const session = PS.normalizePipelineSession({
    spec: { playerCount: 4, chapterKeys: ["ch1"] },
    outline: { logline: "x" },
    narrativeChapters: { ch1: { chapterKey: "ch1", narrativeBody: "x".repeat(500) } },
    locks: { spec: true, outline: true, narrative: true }
  });
  PS.pipelineClearDownstream(session, "spec");
  assert.equal(session.outline, null);
  assert.equal(session.narrativeChapters.ch1, undefined);
  assert.equal(session.locks.outline, false);
  assert.equal(session.locks.narrative, false);
});

test("pipelineDepsLocked requires all dependency layers locked", () => {
  const PS = loadPipelineSession();
  const session = PS.defaultPipelineSession();
  session.locks = { spec: false };
  assert.equal(PS.pipelineDepsLocked(session, "outline"), false);
  session.locks.spec = true;
  assert.equal(PS.pipelineDepsLocked(session, "outline"), true);
  session.locks = { spec: true, outline: true, narrative: false };
  assert.equal(PS.pipelineDepsLocked(session, "matrix"), false);
  session.locks.narrative = true;
  assert.equal(PS.pipelineDepsLocked(session, "matrix"), true);
  session.locks = { spec: true, outline: true, narrative: true, matrix: true, section: false };
  assert.equal(PS.pipelineDepsLocked(session, "structure"), false);
  session.locks.section = true;
  assert.equal(PS.pipelineDepsLocked(session, "structure"), true);
});

test("pipelineStepName strips numbered prefix without breaking CJK", () => {
  const PS = loadPipelineSession();
  assert.equal(PS.pipelineStepName("spec"), "创作设定");
  assert.equal(PS.pipelineStepLabel("narrative"), "③ 章节总剧情");
  assert.equal(PS.pipelineStepLabel("matrix"), "④ 角色矩阵");
});

test("pipelineClearDownstream clears narrative when outline is edited", () => {
  const PS = loadPipelineSession();
  const session = PS.normalizePipelineSession({
    spec: { playerCount: 4, chapterKeys: ["ch1"] },
    outline: { logline: "x" },
    narrativeChapters: { ch1: { chapterKey: "ch1", narrativeBody: "x".repeat(500) } },
    roleMatrix: { roles: [{ key: "a", name: "A" }] },
    locks: { spec: true, outline: true, narrative: true }
  });
  PS.pipelineClearDownstream(session, "outline");
  assert.equal(session.narrativeChapters.ch1, undefined);
  assert.equal(session.roleMatrix, null);
  assert.equal(session.locks.narrative, false);
});

test("pipelineDepsLocked requires narrative before matrix", () => {
  const PS = loadPipelineSession();
  const session = PS.defaultPipelineSession();
  session.locks = { spec: true, outline: true, narrative: false };
  assert.equal(PS.pipelineDepsLocked(session, "matrix"), false);
  session.locks.narrative = true;
  assert.equal(PS.pipelineDepsLocked(session, "matrix"), true);
});
