import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_CLICHE_PHRASES,
  buildAntiAiDialogueBlock,
  buildCombinedSpeechBlock,
  buildDeAiRewriteRubric,
  buildKnowledgeBoundaryBlock,
  scanAiClicheAdvisory,
  scanHeartVerbAdvisory,
  scanMontageAdvisory,
  scanThesisFirstAdvisory
} from "../src/prompts/matrix-speech-style.js";
import { buildLiteraryStyleCard, styleCardForPrompt } from "../src/prompts/matrix-literary-styles.js";
import { buildEraSettingCard, formatEraSpeechBlock } from "../src/prompts/matrix-era-setting.js";

test("buildLiteraryStyleCard includes dialogueGuide and era", () => {
  const card = buildLiteraryStyleCard({
    literaryStyle: "cinematic",
    eraPreset: "lighthouse-industrial"
  });
  assert.ok(card.dialogueGuide?.good);
  assert.equal(card.era.eraPreset, "lighthouse-industrial");
  assert.ok(card.era.speechRegister);
  assert.match(card.dialogueGuide.register, /句长随关系/);
  assert.doesNotMatch(card.dialogueGuide.register, /对白极简/);
});

test("styleCardForPrompt removes reusable prose samples", () => {
  const card = buildLiteraryStyleCard({ literaryStyle: "cinematic", eraPreset: "modern-cn" });
  const safe = styleCardForPrompt(card);
  assert.equal("anchor" in safe, false);
  assert.equal("dialogueGuide" in safe, false);
  assert.equal("dialogueGood" in safe.era, false);
  assert.equal("dialogueBad" in safe.era, false);
});

test("formatEraSpeechBlock exposes register without reusable dialogue samples", () => {
  const era = buildEraSettingCard({ eraPreset: "modern-cn" });
  const block = formatEraSpeechBlock(era);
  assert.ok(block.includes("时代语域"));
  assert.ok(!block.includes("✅"));
  assert.ok(!block.includes("❌"));
  assert.ok(!block.includes(era.dialogueGood));
});

test("buildCombinedSpeechBlock merges voiceHints", () => {
  const styleCard = buildLiteraryStyleCard({ literaryStyle: "web-novel", eraPreset: "campus-2000s" });
  const block = buildCombinedSpeechBlock({
    styleCard,
    eraCard: styleCard.era,
    characterArchive: { name: "小林 · 广播站", voiceHints: "register: 快嘴 blunt\ncatchphrases: 得了吧" }
  });
  assert.ok(block.includes("去 AI 腔"));
  assert.ok(block.includes("小林"));
  assert.ok(block.includes("得了吧"));
});

test("anti-AI dialogue guidance does not equate human speech with short fragments", () => {
  const block = buildAntiAiDialogueBlock();
  assert.ok(block.includes("真人说话没有统一长度"));
  assert.ok(block.includes("不得一律改短") || block.includes("禁止把“口语化”机械处理成两三个字一句"));
  assert.ok(!block.includes("真人说话：**短、断、有省略**"));
});

test("knowledge boundary includes conclusions the role cannot infer yet", () => {
  const block = buildKnowledgeBoundaryBlock({
    knowledgeSources: ["我看见门锁只转了半圈"],
    unknowns: ["谁换了锁"],
    notYetInferred: ["换锁人与昨晚来客是同一个人"],
    forbiddenConclusions: ["周循就是换锁人"],
    allowedSuspicionRange: "可以怀疑钥匙被换过，但不能锁定经手人"
  });
  assert.match(block, /本幕尚未形成的推断/u);
  assert.match(block, /换锁人与昨晚来客/u);
  assert.match(block, /禁止提前抵达的结论/u);
  assert.match(block, /可以怀疑钥匙被换过/u);
});

test("scanAiClicheAdvisory detects common LLM phrases", () => {
  const r = scanAiClicheAdvisory("你不禁感到一阵疑惑，内心深处涌起不安。");
  assert.equal(r.advisory, true);
  assert.ok(r.hits.some((h) => AI_CLICHE_PHRASES.includes(h)));
});

test("scanMontageAdvisory flags parallel roster montage", () => {
  const bad =
    "夜雨未歇，众人聚于客厅。沈念哭诉遗嘱不公，吴福取出撕角文书，顾衡翻账册，宋岚药箱里氰化物标签惹疑。你搓着手，先报自己的行档。";
  const r = scanMontageAdvisory(bad, {
    roleRosterNames: ["沈念 · 侄女", "吴福 · 管家", "顾衡 · 账房", "宋岚 · 医生", "韩铁 · 电报工"]
  });
  assert.equal(r.passed, false);
  assert.ok(r.hits.length > 0);
});

test("scanHeartVerbAdvisory flags lazy heart-verb narration", () => {
  const r = scanHeartVerbAdvisory("你心中暗惊，你曾试图用氰化物毒死他，但未成功。");
  assert.equal(r.advisory, true);
  assert.ok(r.hits.length > 0);
});

test("buildDeAiRewriteRubric includes sensory expression", () => {
  const styleCard = buildLiteraryStyleCard({ literaryStyle: "luxun", eraPreset: "republic-cn" });
  const rubric = buildDeAiRewriteRubric({
    styleCard,
    eraCard: styleCard.era,
    characterArchive: { voiceHints: "sensoryFilter: 满手机油" },
    isKiller: true,
    actIndex: 1,
    finalActIndex: 2
  });
  assert.ok(rubric.includes("感官替心"));
  assert.ok(rubric.includes("结构性真人化"));
  assert.ok(rubric.includes("upstream_rebuild"));
  assert.ok(rubric.includes("混沌视角"));
  assert.ok(!rubric.includes("沈念"));
  assert.ok(!rubric.includes("叔公"));
});

test("scanThesisFirstAdvisory flags essay-like moral framing", () => {
  const r = scanThesisFirstAdvisory(
    "后来的人们回忆起那一年，总会说一切从审判开始。最早，人们都相信机器绝对公平。起初人们以为这就是答案，后来才明白真正的公平不是效率，而是尊严。"
  );
  assert.equal(r.advisory, true);
  assert.equal(r.passed, false);
  assert.ok(r.hits.some((hit) => hit.includes("开场")));
});

test("scanThesisFirstAdvisory leaves concrete in-scene opening alone", () => {
  const r = scanThesisFirstAdvisory(
    "门锁只转了半圈。周循把钥匙拔出来，在裤缝上蹭掉铜屑。屋里的人问了一句，他装作没听见。"
  );
  assert.equal(r.passed, true);
});
