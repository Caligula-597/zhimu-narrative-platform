import test from "node:test";
import assert from "node:assert/strict";
import {
  buildScriptReadthroughCorpus,
  buildMatrixScriptReadthroughMessages,
  validateMatrixScriptReadthroughEvaluation
} from "../src/prompts/matrix-evaluate.js";

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
});
