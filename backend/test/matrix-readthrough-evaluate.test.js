import test from "node:test";
import assert from "node:assert/strict";
import {
  buildScriptReadthroughCorpus,
  buildMatrixEvaluationMessages,
  buildMatrixScriptReadthroughMessages,
  validateMatrixScriptReadthroughEvaluation
} from "../src/prompts/matrix-evaluate.js";
import { validateMatrixEvaluation } from "../src/pipeline-matrix-evaluation-validator.js";

test("buildScriptReadthroughCorpus groups by role with full body", () => {
  const corpus = buildScriptReadthroughCorpus(
    {
      "role-1": { ch1: { body: "第一段正文", title: "t", tasks: ["a"] } }
    },
    { chapterKeys: ["ch1"] },
    { roles: [{ key: "role-1", name: "测试角色" }] }
  );
  assert.equal(corpus.length, 1);
  assert.equal(corpus[0].roleName, "测试角色");
  assert.equal(corpus[0].chapters[0].body, "第一段正文");
});

test("buildMatrixScriptReadthroughMessages omits truth and matrix", () => {
  const msgs = buildMatrixScriptReadthroughMessages({
    setting: { title: "停雪" },
    synopsis: { logline: "雪夜公馆" },
    config: { chapterKeys: ["ch1"] },
    characterArchives: { roles: [{ key: "role-1", name: "韩铁", publicIdentity: "电工" }] },
    scripts: { "role-1": { ch1: { body: "你从地下室上来", tasks: [] } } }
  });
  const user = msgs.find((m) => m.role === "user")?.content || "";
  assert.match(user, /你从地下室上来/);
  assert.doesNotMatch(user, /真相 Bible/);
  assert.doesNotMatch(user, /clueLedger/);
  const system = msgs.find((m) => m.role === "system")?.content || "";
  assert.match(system, /反 AI 母体审查/);
  assert.match(system, /thesisPredictability/);
  assert.match(system, /livedExperience/);
  assert.match(system, /dramaticTension/);
});

test("validateMatrixScriptReadthroughEvaluation normalizes scores", () => {
  const out = validateMatrixScriptReadthroughEvaluation({
    overallScore: 8.2,
    verdict: "尚可",
    scores: { perspectiveLimit: 6, antiAiFlavor: 5 },
    readyForPlayers: false
  });
  assert.equal(out.scoringMode, "script-readthrough");
  assert.equal(out.scores.perspectiveLimit, 6);
  assert.equal(out.scores.immersion, 7);
  assert.equal(out.scores.thesisPredictability, 7);
  assert.equal(out.scores.dramaticTension, 1);
});

test("readthrough cannot pass when fairness has flattened dramatic tension", () => {
  const out = validateMatrixScriptReadthroughEvaluation({
    overallScore: 8.5,
    scores: {
      perspectiveLimit: 8,
      antiAiFlavor: 8,
      thesisPredictability: 8,
      subtext: 8,
      livedExperience: 8,
      playableOutline: 8,
      dramaticTension: 4
    },
    issues: [],
    readyForPlayers: true
  });
  assert.equal(out.readyForPlayers, false);
});

test("readthrough cannot pass when thesis-first and lived-experience gates are weak", () => {
  const out = validateMatrixScriptReadthroughEvaluation({
    overallScore: 9,
    scores: {
      perspectiveLimit: 8,
      antiAiFlavor: 8,
      thesisPredictability: 4,
      subtext: 8,
      livedExperience: 5,
      playableOutline: 9
    },
    issues: [],
    readyForPlayers: true
  });
  assert.equal(out.readyForPlayers, false);
});

test("matrix evaluation prompt runs adversarial table tests", () => {
  const messages = buildMatrixEvaluationMessages({
    setting: { playStructure: "faction" }, synopsis: {}, config: {}, truthBible: {}, characterArchives: {}, clueNetwork: {}, infoMatrix: {}, scripts: {}
  });
  const prompt = messages.map((message) => message.content).join("\n");
  assert.match(prompt, /红队桌测/u);
  assert.match(prompt, /利己玩家/u);
  assert.match(prompt, /沉默玩家/u);
  assert.match(prompt, /错误共识/u);
  assert.match(prompt, /删除角色/u);
  assert.match(prompt, /redTeamFindings/u);
});

test("high red-team finding blocks an otherwise passing evaluation", () => {
  const scores = Object.fromEntries([
    "humanAuthorship", "consequenceContinuity", "dramaticTension", "logicalCoherence", "informationSymmetry",
    "clueTopology", "clueResilience", "cooperationRhythm", "roleAgency", "materialOperability", "sharedSceneConsistency"
  ].map((key) => [key, 9]));
  const output = validateMatrixEvaluation({
    scores,
    issues: [],
    readyForSync: true,
    redTeamFindings: [
      { scenario: "selfish_withholder", severity: "low", result: "passed" },
      { scenario: "silent_player", severity: "high", result: "blocked" },
      { scenario: "clue_saboteur", severity: "low", result: "passed" },
      { scenario: "false_consensus", severity: "low", result: "passed" },
      { scenario: "novice_host", severity: "low", result: "passed" },
      { scenario: "remove_role", severity: "low", result: "passed" }
    ]
  }, { playStructure: "faction" });
  assert.equal(output.redTeamComplete, true);
  assert.equal(output.readyForSync, false);
});

test("evaluation cannot pass when any required red-team scenario is omitted", () => {
  const scores = Object.fromEntries([
    "humanAuthorship", "consequenceContinuity", "dramaticTension", "logicalCoherence", "informationSymmetry",
    "clueTopology", "clueResilience", "cooperationRhythm", "roleAgency", "materialOperability", "sharedSceneConsistency"
  ].map((key) => [key, 9]));
  const output = validateMatrixEvaluation({ scores, issues: [], readyForSync: true, redTeamFindings: [] }, { playStructure: "faction" });
  assert.equal(output.redTeamComplete, false);
  assert.equal(output.readyForSync, false);
});
