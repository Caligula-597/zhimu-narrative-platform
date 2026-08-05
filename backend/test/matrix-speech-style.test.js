import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_CLICHE_PHRASES,
  buildCombinedSpeechBlock,
  buildDeAiRewriteRubric,
  scanAiClicheAdvisory,
  scanHeartVerbAdvisory,
  scanMontageAdvisory
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
  assert.ok(rubric.includes("混沌视角"));
  assert.ok(!rubric.includes("沈念"));
  assert.ok(!rubric.includes("叔公"));
});
