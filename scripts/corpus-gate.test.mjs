import test from "node:test";
import assert from "node:assert/strict";
import {
  extractCorpusFeatures,
  peerInterval,
  statusAgainstPeer,
  renderCorpusDashboard
} from "./corpus-gate-features.mjs";

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
