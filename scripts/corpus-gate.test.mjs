import test from "node:test";
import assert from "node:assert/strict";
import {
  extractCorpusFeatures,
  peerInterval,
  statusAgainstPeer,
  renderCorpusDashboard
} from "./corpus-gate-features.mjs";
import {
  chunkKindParagraphs,
  mixKindCoverage,
  parseKindItems,
  renderKindDashboard,
  renderNamedReport,
  splitKindParagraphs
} from "./corpus-gate-semantic.mjs";
import {
  consecutiveDealChains,
  featureAllowedForReliability,
  inspectParagraphQuality,
  informationDeliveryProfile,
  mixNewFactPathways,
  parseAxisItems,
  renderHumanVsAiProfile,
  sampleConsecutiveParagraphs
} from "./corpus-gate-axes.mjs";

test("dialogue handoff and cognition features move in the expected direction", () => {
  const qa = extractCorpusFeatures(`你问他火场有没有人。
「老廖那晚衣服湿了。」
你又问棉衣是谁的。
「值班室里有一件，我没看清。」`);
  const summary = extractCorpusFeatures("七点以前最乱。你立刻意识到这不是巧合。事情开始复杂。");
  assert.ok(qa.values.consecutive_qa_handoffs_per_10k > summary.values.consecutive_qa_handoffs_per_10k);
  assert.ok(summary.values.cognition_verb_per_10k > qa.values.cognition_verb_per_10k);
  assert.ok(summary.labels.some((row) => row.labels.includes("cognition")));
});

test("peer interval marks in-range and extreme without pass/fail scores", () => {
  const low = extractCorpusFeatures("你把合同放进抽屉。\n他没有说话。\n车间还在响。");
  const high = extractCorpusFeatures("你问过吗？\n「赵顺没回家。」\n你又问照片。\n「家属觉得像。」\n你再问一遍。\n「我看不清。」");
  const interval = peerInterval([low, high, low], "dialogue_char_ratio");
  assert.equal(statusAgainstPeer(low.values.dialogue_char_ratio, interval), "in_range");
  assert.ok(["high", "extreme", "in_range"].includes(statusAgainstPeer(0.99, interval)));
  const md = renderCorpusDashboard({
    works: [
      { title: "样本A", peerGroup: "mystery", features: low, methods: ["plain_text"], cacheHits: 1, pending: 0 },
      { title: "样本B", peerGroup: "mystery", features: high, methods: ["docx"], cacheHits: 0, pending: 2 },
      { title: "机制样本", peerGroup: "mechanism", features: low, methods: ["image_ocr"], cacheHits: 2, pending: 0 }
    ]
  });
  assert.match(md, /## mystery/);
  assert.match(md, /## mechanism/);
  assert.doesNotMatch(md, /真人感/);
});

test("kind parser keeps original paragraphs and ignores rewrites", () => {
  const paragraphs = splitKindParagraphs("你把合同放进抽屉。\n「尾款今晚补。」\n灯还亮着。");
  const chunk = chunkKindParagraphs(paragraphs, 80)[0];
  const rows = parseKindItems({
    items: [
      { i: 1, label: "object_use" },
      { i: 2, label: "information_handoff", text: "改写过的句子" },
      { i: 3, label: "ambient_only" },
      { i: 4, label: "spoken_exchange" }
    ]
  }, chunk);
  assert.equal(rows[0].paragraph, "你把合同放进抽屉。");
  assert.equal(rows[0].label, "object_use");
  assert.equal(rows[1].label, "unlabeled");
  assert.equal(rows[2].label, "ambient_only");
  const mix = mixKindCoverage(rows);
  assert.ok(mix.ratios.object_use > 0);
  assert.match(renderKindDashboard([{ title: "样本", kindMix: mix }]), /通读种类占比/);
});

test("named report lists script titles without play-type buckets", () => {
  const features = extractCorpusFeatures("你把合同放进抽屉。\n灯还亮着。");
  const md = renderNamedReport([
    { title: "《溯月》", methods: ["docx"], features, kindMix: mixKindCoverage([{ paragraph: "你把合同放进抽屉。", label: "object_use" }]) }
  ]);
  assert.match(md, /## 《溯月》/);
  assert.doesNotMatch(md, /mystery|mechanism|情感本|推理本/);
});

test("axis parser keeps conversation and new_fact together", () => {
  const paragraphs = splitKindParagraphs("老陈一边给你装货，一边骂小赵昨天又没来，说排班表还在抽屉里。");
  const chunk = { start: 0, paragraphs };
  const rows = parseAxisItems({
    items: [{
      i: 1,
      mode: ["conversation", "current_action"],
      info: ["new_fact"],
      delivery: "incidental",
      role: "work_process",
      text: "不该留下"
    }]
  }, chunk);
  assert.equal(rows[0].mode[0], "unlabeled");
  const kept = parseAxisItems({
    items: [{
      i: 1,
      mode: ["conversation", "current_action"],
      info: ["new_fact"],
      delivery: "incidental",
      role: "work_process"
    }]
  }, chunk);
  assert.deepEqual(kept[0].mode, ["conversation", "current_action"]);
  assert.ok(kept[0].info.includes("new_fact"));
  assert.equal(kept[0].delivery, "incidental");
  const mix = mixNewFactPathways(kept);
  assert.ok(mix.byMode.conversation > 0);
  assert.ok(mix.byDelivery.incidental > 0);
});

test("ocr-sensitive features stay off D/E scans", () => {
  assert.equal(featureAllowedForReliability("high", "A"), true);
  assert.equal(featureAllowedForReliability("high", "D"), false);
  assert.equal(featureAllowedForReliability("low", "D"), true);
  assert.equal(featureAllowedForReliability("low", "E"), false);
});

test("consecutive sample keeps order and length", () => {
  const rows = Array.from({ length: 100 }, (_, i) => `段${i}`);
  const picked = sampleConsecutiveParagraphs(rows, 40, 7);
  assert.equal(picked.paragraphs.length, 40);
  assert.equal(picked.paragraphs[1], `段${picked.start + 1}`);
});

test("axis chunks cap item count so short beats do not overflow json", () => {
  const rows = Array.from({ length: 50 }, () => "你把票放回柜台。");
  const chunks = chunkKindParagraphs(rows, 1600, 20);
  assert.ok(chunks.length >= 3);
  assert.ok(chunks.every((chunk) => chunk.paragraphs.length <= 20));
});

test("quality sentinel catches two-column merge and page numbers", () => {
  assert.equal(inspectParagraphQuality("第4页"), "skip_layout");
  assert.equal(inspectParagraphQuality("AZG cn ss NN mr NE"), "skip_ocr");
  assert.equal(
    inspectParagraphQuality("你将弟弟介绍进养生坊成为36号技师，主要任务:营业额达到红牌榜"),
    "skip_ocr_merged"
  );
  assert.equal(inspectParagraphQuality("你根据信上的指引走进临江阁。"), "");
});

test("delivery profile keeps qa and incidental conversation on separate rows", () => {
  const qa = { paragraph: "甲".repeat(20), info: ["new_fact"], mode: ["conversation"], delivery: "direct_answer" };
  const side = { paragraph: "乙".repeat(20), info: ["new_fact"], mode: ["conversation"], delivery: "incidental" };
  const work = { paragraph: "丙".repeat(10), info: ["new_fact"], mode: ["current_action"], delivery: "work_discovery" };
  const look = { paragraph: "丁".repeat(10), info: ["new_fact"], mode: ["current_action"], delivery: "observed" };
  const tell = { paragraph: "戊".repeat(40), info: ["new_fact"], mode: ["background_recollection"], delivery: "narrator_exposition" };
  const skip = { paragraph: "第3页", quality: "skip_layout", mode: ["skip_layout"], info: ["skip_layout"], delivery: "skip_layout" };
  const profile = informationDeliveryProfile([qa, qa, side, work, look, tell, skip]);
  assert.equal(profile.pathways.direct_answer, 40 / 120);
  assert.equal(profile.pathways.incidental_conversation, 20 / 120);
  assert.equal(profile.pathways.via_action, 20 / 120);
  assert.equal(profile.pathways.observed, 10 / 120);
  assert.equal(profile.pathways.narrator, 40 / 120);
  const chains = consecutiveDealChains([qa, qa, side, work]);
  assert.equal(chains.max, 2);
  assert.equal(chains.mean, 2);
  const md = renderHumanVsAiProfile({
    ai: { title: "测试A（AI）", profile },
    humans: [{ title: "《溯月》A", profile: informationDeliveryProfile([side, look]) }]
  });
  assert.match(md, /直接问答获得新事实/);
  assert.match(md, /测试A（AI）/);
  assert.doesNotMatch(md, /PASS\/FAIL|标通过/);
  assert.match(md, /办事无产出覆盖/);
});
