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
    setting: { theme: "测试", playerCount: 4, chapterCount: 1, wordsPerChapter: 8000 },
    synopsis: { body: "纲要" },
    config: { playerCount: 4, chapterKeys: ["ch1"] },
    narrativeChapters: { ch1: { chapterKey: "ch1", narrativeBody: "x".repeat(4000) } },
    rolesMeta: { roles: [{ key: "a", name: "A" }] },
    sections: { a: { ch1: { body: "x".repeat(260) } } },
    proposal: { chapters: [{ key: "ch1", title: "T" }] }
  });
  assert.equal(session.locks.setup, true);
  assert.equal(session.locks.narrative, true);
  assert.equal(session.locks.roles, true);
});

test("pipelineClearDownstream clears narrative when setup is edited", () => {
  const PS = loadPipelineSession();
  const session = PS.normalizePipelineSession({
    setting: { theme: "测试", playerCount: 4, chapterCount: 1, wordsPerChapter: 8000 },
    synopsis: { body: "纲要" },
    config: { playerCount: 4, chapterKeys: ["ch1"] },
    narrativeChapters: { ch1: { chapterKey: "ch1", narrativeBody: "x".repeat(4000) } },
    locks: { setup: true, narrative: true }
  });
  PS.pipelineClearDownstream(session, "setup");
  assert.equal(session.narrativeChapters.ch1, undefined);
  assert.equal(session.locks.narrative, false);
});

test("pipelineDepsLocked requires setup before narrative", () => {
  const PS = loadPipelineSession();
  const session = PS.defaultPipelineSession();
  session.locks = { setup: false };
  assert.equal(PS.pipelineDepsLocked(session, "narrative"), false);
  session.locks.setup = true;
  assert.equal(PS.pipelineDepsLocked(session, "narrative"), true);
});

test("pipelineStepName strips numbered prefix without breaking CJK", () => {
  const PS = loadPipelineSession();
  assert.equal(PS.pipelineStepName("setup"), "创作立项");
  assert.equal(PS.pipelineStepLabel("narrative"), "② 逐章总剧情");
  assert.equal(PS.pipelineStepLabel("roles"), "③ 角色私人本");
});

test("pipelineClearDownstream clears roles when narrative is edited", () => {
  const PS = loadPipelineSession();
  const session = PS.normalizePipelineSession({
    setting: { theme: "测试", playerCount: 4, chapterCount: 1, wordsPerChapter: 8000 },
    synopsis: { body: "纲要" },
    config: { playerCount: 4, chapterKeys: ["ch1"] },
    narrativeChapters: { ch1: { chapterKey: "ch1", narrativeBody: "x".repeat(4000) } },
    rolesMeta: { roles: [{ key: "a", name: "A" }] },
    locks: { setup: true, narrative: true }
  });
  PS.pipelineClearDownstream(session, "narrative");
  assert.ok(session.narrativeChapters.ch1);
  assert.equal(session.rolesMeta, null);
  assert.equal(session.locks.roles, false);
});

test("pipelineDepsLocked requires narrative before roles", () => {
  const PS = loadPipelineSession();
  const session = PS.defaultPipelineSession();
  session.locks = { setup: true, narrative: false };
  assert.equal(PS.pipelineDepsLocked(session, "roles"), false);
  session.locks.narrative = true;
  assert.equal(PS.pipelineDepsLocked(session, "roles"), true);
});

test("pipelineDepsLocked requires evaluate before sync", () => {
  const PS = loadPipelineSession();
  const session = PS.defaultPipelineSession();
  session.locks = { setup: true, narrative: true, roles: true, evaluate: false };
  assert.equal(PS.pipelineDepsLocked(session, "sync"), false);
  session.locks.evaluate = true;
  assert.equal(PS.pipelineDepsLocked(session, "sync"), true);
});
