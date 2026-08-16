import assert from "node:assert/strict";
import test from "node:test";
import { buildStoryEvaluationMessages } from "../src/prompts/evaluate.js";
import { buildStoryOutlineMessages } from "../src/prompts/outline.js";
import {
  SOURCE_ADAPTATION_CONTINUITY_BLOCK,
  SOURCE_ADAPTATION_GENERATION_BLOCK,
  SOURCE_ADAPTATION_REVIEW_BLOCK,
  buildSourceAdaptationPreflightMessages,
  buildSourceAdaptationPreflightRepairMessages,
  validateSourceAdaptationPreflight
} from "../src/prompts/source-adaptation-fidelity.js";
import { validateStoryEvaluation } from "../src/deepseek-validation/evaluation-validator.js";
import { normalizeStoryBrief } from "../src/deepseek-validation/input-contract.js";

test("source adaptation preflight forbids premature story ideation", () => {
  const messages = buildSourceAdaptationPreflightMessages({
    title: "价值的幻觉与文明的底线",
    sourceMaterial: "位置改变价格。AI又会改变位置。代际承诺依赖信任。"
  });
  const system = messages[0].content;
  const user = messages[1].content;
  assert.match(system, /禁止起案名、写 logline、发明人物/);
  assert.match(system, /thoughtMovement/);
  assert.match(system, /conflictLedger/);
  assert.match(system, /反事实删除测试/);
  assert.match(system, /预检阶段禁止合并核心矛盾/);
  assert.match(system, /不得擅自改写成“自我认同、价值虚无/);
  assert.match(system, /因果铰链测试/);
  assert.match(system, /不得反问作者“这一大段是否需要保留”/);
  assert.match(system, /禁止填写人物欲望、心理成长/);
  assert.match(system, /thoughtMovement 必须按原素材首次出现顺序排列/);
  assert.match(system, /semantic_substitution/);
  assert.match(user, /完整原素材/);
  assert.match(user, /代际承诺依赖信任/);
});

test("adaptation prompt blocks single-hook semantic substitution across stages", () => {
  assert.match(SOURCE_ADAPTATION_GENERATION_BLOCK, /high-loss compression/);
  assert.match(SOURCE_ADAPTATION_GENERATION_BLOCK, /semantic substitution/);
  assert.match(SOURCE_ADAPTATION_GENERATION_BLOCK, /人物行动、议价权变化、即时得失、后续反噬/);
  assert.match(SOURCE_ADAPTATION_CONTINUITY_BLOCK, /正文扩写不得二次换题/);
  assert.match(SOURCE_ADAPTATION_REVIEW_BLOCK, /shock_substitution/);
  assert.match(SOURCE_ADAPTATION_REVIEW_BLOCK, /source_truncation/);
});

test("outline prompt requires every non-mergeable source conflict to be covered", () => {
  const messages = buildStoryOutlineMessages(
    {
      title: "测试",
      premise: "婚姻资源形成旧账；平台制造赢家；AI重置价格；代际承诺到期。",
      generationContract: {}
    },
    { playerCount: 4, chapterCount: 3, chapterKeys: ["chapter-1", "chapter-2", "chapter-3"] }
  );
  const system = messages[0].content;
  assert.match(system, /禁止用高概念换题/);
  assert.match(system, /每组都必须有独立条目/);
  assert.match(system, /人物行动；议价权变化；即时得失；延迟后果/);
});

test("evaluation prompt receives the full long premise and red-teams source substitution", () => {
  const tail = "后半段代际信任不得丢失";
  const longPremise = `${"前段素材".repeat(700)}${tail}`;
  const messages = buildStoryEvaluationMessages({
    brief: { title: "长口播", premise: longPremise },
    setting: null,
    synopsis: null
  });
  const system = messages[0].content;
  const user = messages[1].content;
  assert.match(system, /原素材忠实度红队/);
  assert.match(system, /sourceFidelityAudit/);
  assert.match(user, new RegExp(tail));
});

test("source fidelity failure prevents evaluation import", () => {
  const result = validateStoryEvaluation({
    overallScore: 9,
    scores: {
      playability: 9,
      fairness: 9,
      multiRoleDesign: 9,
      pacing: 9,
      graphReady: 9,
      consistency: 9,
      styleFit: 9,
      humanAuthorship: 9,
      sourceFidelity: 9,
      subtext: 9,
      voiceDistinctness: 9
    },
    sourceFidelityAudit: {
      verdict: "semantic_substitution",
      substitutions: ["只保留价格与尊严，另造拆迁故事"]
    },
    readyForImport: true
  });
  assert.equal(result.readyForImport, false);
  assert.equal(result.sourceFidelityAudit.verdict, "semantic_substitution");
});

test("story brief keeps source material beyond the old 4000-character cutoff", () => {
  const tail = "必须保留的后半段代际契约";
  const premise = `${"甲".repeat(5000)}${tail}`;
  const brief = normalizeStoryBrief({ title: "长素材", premise });
  assert.equal(brief.premise.length, premise.length);
  assert.match(brief.premise, new RegExp(tail));
});

test("preflight validator rejects premature conflict merging even when model declares ready", () => {
  const source = "位置改变价格。婚姻中的钱由议价权决定。";
  const result = validateSourceAdaptationPreflight({
    thoughtMovement: [
      { id: "thought-1", sourceAnchor: "位置改变价格。" },
      { id: "thought-2", sourceAnchor: "婚姻中的钱由议价权决定。" }
    ],
    conflictLedger: [{
      id: "conflict-1",
      thoughtIds: ["thought-1", "thought-2"],
      sourceAnchor: "位置改变价格。",
      pressureA: { sourceAnchor: "位置改变价格。", claimOrPressure: "位置定价" },
      pressureB: { sourceAnchor: "婚姻中的钱由议价权决定。", claimOrPressure: "家庭议价" },
      powerBasis: "平台位置",
      causalFunction: "bridge",
      requiredFutureReversal: "位置失去后同一规则反噬",
      sourceConsequence: "价格改变",
      adaptationObligation: "保留规则换手",
      forbiddenShortcut: "自我成长"
    }],
    causalEdges: [],
    coverageAudit: {
      mustPreserveThoughtIds: ["thought-1", "thought-2"],
      mustPreserveConflictIds: ["conflict-1"],
      readyForPremise: true
    }
  }, source);
  assert.equal(result.passed, false);
  assert.equal(result.readyForPremise, false);
  assert.ok(result.issues.some((issue) => issue.includes("禁止提前合并")));
});

test("preflight validator rejects thought stages appended out of source order", () => {
  const source = "先讨论排名。后来讨论AI。";
  const common = {
    structuralLevel: "technology",
    pressureA: { sourceAnchor: "先讨论排名。", claimOrPressure: "排名" },
    pressureB: { sourceAnchor: "后来讨论AI。", claimOrPressure: "AI" },
    powerBasis: "平台",
    causalFunction: "escalation",
    requiredFutureReversal: "规则换手",
    sourceConsequence: "评价变化",
    adaptationObligation: "保留顺序",
    forbiddenShortcut: "科技伦理"
  };
  const result = validateSourceAdaptationPreflight({
    thoughtMovement: [
      { id: "thought-ai", sourceAnchor: "后来讨论AI。" },
      { id: "thought-rank", sourceAnchor: "先讨论排名。" }
    ],
    conflictLedger: [
      { id: "conflict-ai", thoughtIds: ["thought-ai"], sourceAnchor: "后来讨论AI。", ...common },
      { id: "conflict-rank", thoughtIds: ["thought-rank"], sourceAnchor: "先讨论排名。", ...common }
    ],
    causalEdges: [{ fromConflictId: "conflict-rank", toConflictId: "conflict-ai", edgeType: "escalation" }],
    coverageAudit: {
      mustPreserveThoughtIds: ["thought-ai", "thought-rank"],
      mustPreserveConflictIds: ["conflict-ai", "conflict-rank"],
      readyForPremise: true
    }
  }, source);
  assert.equal(result.readyForPremise, false);
  assert.ok(result.issues.some((issue) => issue.includes("出现顺序")));
});

test("preflight validator rejects psychological substitution in grounded fields", () => {
  const source = "平台决定价格。位置变化会使价格改变。";
  const result = validateSourceAdaptationPreflight({
    thoughtMovement: [{ id: "thought-1", sourceAnchor: "平台决定价格。" }],
    conflictLedger: [{
      id: "conflict-1",
      thoughtIds: ["thought-1"],
      sourceAnchor: "平台决定价格。",
      pressureA: { sourceAnchor: "平台决定价格。", claimOrPressure: "平台定价" },
      pressureB: { sourceAnchor: "位置变化会使价格改变。", claimOrPressure: "位置变化" },
      powerBasis: "平台位置",
      causalFunction: "bridge",
      requiredFutureReversal: "位置变化会使价格改变",
      sourceConsequence: "价格改变",
      adaptationObligation: "让人物寻找内在价值",
      forbiddenShortcut: "心理成长"
    }],
    causalEdges: [],
    coverageAudit: {
      mustPreserveThoughtIds: ["thought-1"],
      mustPreserveConflictIds: ["conflict-1"],
      readyForPremise: true
    }
  }, source);
  assert.equal(result.readyForPremise, false);
  assert.ok(result.issues.some((issue) => issue.includes("心理母题")));
});

test("preflight repair prompt preserves the no-story boundary and exposes audit failures", () => {
  const messages = buildSourceAdaptationPreflightRepairMessages({
    sourceMaterial: "排名把人压缩成数字。",
    rejectedDraft: { thoughtMovement: [] },
    audit: { missingSemanticGroups: [{ key: "ranking-datafication" }] }
  });
  assert.match(messages[0].content, /退回修复轮/);
  assert.match(messages[0].content, /不得趁机生成故事/);
  assert.match(messages[1].content, /ranking-datafication/);
  assert.match(messages[1].content, /返回完整修复版 JSON/);
});
