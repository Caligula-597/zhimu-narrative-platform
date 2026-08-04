import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDeepseekProposal,
  validateManuscriptSynopsis,
  validateRoleMatrix,
  validateRoleSection,
  validateStoryOutline,
  validateStorySpec,
  validateStoryEvaluation,
  validateChapterNarrative,
  validateRolesFromNarrative,
  normalizeStoryBrief
} from "../src/deepseek.js";

const brief = normalizeStoryBrief({ title: "测试本", chapterCount: 2, playerCount: 4 });

test("validateStorySpec normalizes chapter keys", () => {
  const spec = validateStorySpec({ playerCount: 4, chapterCount: 2, chapterKeys: ["chapter-1", "chapter-2"] }, brief);
  assert.equal(spec.playerCount, 4);
  assert.deepEqual(spec.chapterKeys, ["chapter-1", "chapter-2"]);
});

test("validateStoryOutline requires chapter beats", () => {
  const spec = validateStorySpec({ playerCount: 4, chapterKeys: ["chapter-1"], chapterCount: 1 }, brief);
  const outline = validateStoryOutline({
    logline: "集成测试剧本",
    truthTimeline: "真相",
    chapterBeats: [{ chapterKey: "chapter-1", title: "入港", goal: "集合", turn: "发现尸体", hostNotes: "勿剧透" }]
  }, spec);
  assert.equal(outline.chapterBeats.length, 1);
  assert.equal(outline.readiness.readyForExpansion, false);
});

test("validateDeepseekProposal checks edge references", () => {
  const proposal = validateDeepseekProposal({
    title: "提案",
    logline: "冲突",
    chapters: [{ key: "chapter-1", title: "第一章", summary: "s", sequence: 1 }],
    scenes: [{ key: "scene-1", chapterKey: "chapter-1", name: "码头", publicText: "public", hostText: "host" }],
    investigationPoints: [{ key: "point-1", sceneKey: "scene-1", name: "搜证", description: "d", resultText: "r", clueKey: "clue-1" }],
    clues: [{ key: "clue-1", name: "信件", publicText: "p", hostText: "h" }],
    edges: [{ fromType: "scene", fromKey: "scene-1", toType: "investigation_point", toKey: "point-1", relationType: "extension", label: "入口" }],
    suggestions: []
  });
  assert.equal(proposal.scenes.length, 1);
});

test("validateRoleMatrix enforces player count", () => {
  const spec = validateStorySpec({ playerCount: 4, chapterKeys: ["chapter-1"], chapterCount: 1 }, brief);
  const proposal = validateDeepseekProposal({
    title: "提案",
    chapters: [{ key: "chapter-1", title: "第一章", summary: "s", sequence: 1 }],
    scenes: [{ key: "scene-1", chapterKey: "chapter-1", name: "码头", publicText: "p", hostText: "h" }],
    investigationPoints: [],
    clues: [],
    edges: [],
    suggestions: []
  });
  const matrix = validateRoleMatrix({
    roles: [1, 2, 3, 4].map((n) => ({
      key: `role-${n}`,
      name: `角色${n}`,
      publicProfile: "p",
      privateProfile: "s",
      chapterKnowledge: [{ chapterKey: "chapter-1", knows: "k", mustHide: "h", canDiscuss: "c" }]
    })),
    crossChecks: [],
    suggestions: []
  }, spec, proposal);
  assert.equal(matrix.roles.length, 4);
});

test("validateRoleSection enforces minimum length", () => {
  const body = "中".repeat(260);
  const section = validateRoleSection({ roleKey: "role-1", chapterKey: "chapter-1", title: "标题", body }, "role-1", "chapter-1", 250);
  assert.ok(section.body.length >= 250);
});

test("validateManuscriptSynopsis requires minimum length", () => {
  const proposal = validateDeepseekProposal({
    title: "提案",
    chapters: [{ key: "chapter-1", title: "第一章", summary: "s", sequence: 1 }],
    scenes: [{ key: "scene-1", chapterKey: "chapter-1", name: "码头", publicText: "p", hostText: "h" }],
    investigationPoints: [],
    clues: [],
    edges: [],
    suggestions: []
  });
  const synopsis = validateManuscriptSynopsis({
    title: "提案",
    summary: "简介",
    overallManuscript: "中".repeat(500),
    logicNotes: ["逻辑"]
  }, proposal);
  assert.ok(synopsis.overallManuscript.length >= 400);
});

test("validateStoryEvaluation normalizes revisions and style", () => {
  const ev = validateStoryEvaluation({
    overallScore: 6.5,
    verdict: "需修改",
    scores: { playability: 7, fairness: 4, styleFit: 6 },
    styleAlignment: { matchLevel: "medium", summary: "风格基本符合", keepEmphasis: ["悬疑"], adjustEmphasis: ["减少内奸"] },
    revisions: [{ targetLayer: "roleMatrix", targetKey: "role-1", priority: "must_fix", problem: "内应", direction: "改为证人", promptHint: "不要内奸角色", preserve: "悬疑氛围" }],
    nextStepOrder: ["roleMatrix", "outline"],
    readyForImport: true
  });
  assert.equal(ev.revisions[0].targetLayer, "roles");
  assert.equal(ev.revisions[0].promptHint, "不要内奸角色");
  assert.equal(ev.readyForImport, false);
  assert.deepEqual(ev.nextStepOrder, ["roles", "setup"]);
});

test("validateChapterNarrative enforces minimum body length", () => {
  const spec = validateStorySpec({ playerCount: 4, chapterKeys: ["chapter-1", "chapter-2"], chapterCount: 2 }, brief);
  const ch = validateChapterNarrative({
    chapterKey: "chapter-1",
    title: "入港",
    summary: "众人到港",
    narrativeBody: "中".repeat(2500),
    hostNotes: "勿剧透"
  }, spec, "chapter-1", 2000);
  assert.equal(ch.chapterKey, "chapter-1");
  assert.ok(ch.narrativeBody.length >= 2000);
});

test("validateChapterNarrative rejects short body with DEEPSEEK_OUTPUT_INVALID", () => {
  const spec = validateStorySpec({ playerCount: 4, chapterKeys: ["chapter-1"], chapterCount: 1 }, brief);
  assert.throws(
    () => validateChapterNarrative({
      chapterKey: "chapter-1",
      title: "入港",
      summary: "众人到港",
      narrativeBody: "短",
      hostNotes: "勿剧透"
    }, spec, "chapter-1", 2000),
    (err) => err.code === "DEEPSEEK_OUTPUT_INVALID" && /2000/.test(err.message)
  );
});

test("validateRolesFromNarrative builds section map", () => {
  const spec = validateStorySpec({ playerCount: 4, chapterKeys: ["chapter-1"], chapterCount: 1, wordsPerSectionMin: 250 }, brief);
  const proposal = validateDeepseekProposal({
    title: "提案",
    chapters: [{ key: "chapter-1", title: "第一章", summary: "s", sequence: 1 }],
    scenes: [{ key: "scene-1", chapterKey: "chapter-1", name: "码头", publicText: "p", hostText: "h" }],
    investigationPoints: [],
    clues: [],
    edges: [],
    suggestions: []
  });
  const matrix = validateRoleMatrix({
    roles: [1, 2, 3, 4].map((n) => ({
      key: `role-${n}`,
      name: `角色${n}`,
      publicProfile: "p",
      privateProfile: "s",
      chapterKnowledge: [{ chapterKey: "chapter-1", knows: "k", mustHide: "h", canDiscuss: "c" }]
    })),
    crossChecks: [],
    suggestions: []
  }, spec, proposal);
  const body = "中".repeat(260);
  const parsed = validateRolesFromNarrative({
    sections: [1, 2, 3, 4].map((n) => ({
      roleKey: `role-${n}`,
      chapterKey: "chapter-1",
      title: `角色${n}`,
      body
    }))
  }, spec, matrix);
  assert.ok(parsed.sections["role-1"]["chapter-1"].body.length >= 250);
});
