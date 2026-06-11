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
    proposal: { chapters: [] },
    roleMatrix: { roles: [{ key: "a", name: "A" }] },
    sections: { a: { ch1: { body: "x" } } }
  });
  assert.equal(session.locks.spec, true);
  assert.equal(session.locks.outline, true);
  assert.equal(session.locks.structure, true);
  assert.equal(session.locks.matrix, true);
});

test("pipelineClearDownstream clears outline when spec is edited", () => {
  const PS = loadPipelineSession();
  const session = PS.normalizePipelineSession({
    spec: { playerCount: 4, chapterKeys: ["ch1"] },
    outline: { logline: "x" },
    proposal: { chapters: [{ key: "ch1", title: "T" }] },
    locks: { spec: true, outline: true, structure: true }
  });
  PS.pipelineClearDownstream(session, "spec");
  assert.equal(session.outline, null);
  assert.equal(session.proposal, null);
  assert.equal(session.locks.outline, false);
  assert.equal(session.locks.structure, false);
});

test("pipelineDepsLocked requires all dependency layers locked", () => {
  const PS = loadPipelineSession();
  const session = PS.defaultPipelineSession();
  session.locks = { spec: false };
  assert.equal(PS.pipelineDepsLocked(session, "outline"), false);
  session.locks.spec = true;
  assert.equal(PS.pipelineDepsLocked(session, "outline"), true);
  session.locks = { spec: true, outline: false };
  assert.equal(PS.pipelineDepsLocked(session, "structure"), false);
  session.locks.outline = true;
  assert.equal(PS.pipelineDepsLocked(session, "structure"), true);
});

test("pipelineStepName strips numbered prefix without breaking CJK", () => {
  const PS = loadPipelineSession();
  assert.equal(PS.pipelineStepName("spec"), "规格");
  assert.equal(PS.pipelineStepLabel("matrix"), "④ 角色矩阵");
});
