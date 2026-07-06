import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLiteraryStyleCard,
  resolveLiteraryStyleKey,
  resolveMysteryStyleKey,
  listLiteraryStyleOptions
} from "../src/prompts/matrix-literary-styles.js";
import { mechanicalTruthCompare, validateTruthReconstruction } from "../src/prompts/matrix-truth-reconstruction.js";
import {
  mechanicalInnocentInferenceCompare,
  validateInnocentScriptsInference,
  renderInnocentInferenceMarkdown
} from "../src/prompts/matrix-innocent-inference.js";
import { resolveKillerAwareness, buildKillerAwarenessContract } from "../src/prompts/matrix-killer-awareness.js";
import { buildPublicActionBrief } from "../src/pipeline-matrix-structured-script.js";

test("resolveKillerAwareness maps labels", () => {
  assert.equal(resolveKillerAwareness({ killerAwareness: "self-unaware" }), "self-unaware");
  assert.equal(resolveKillerAwareness({ killerAwareness: "自知" }), "self-aware");
});

test("buildKillerAwarenessContract self-aware innocent gets suspicion hooks", () => {
  const c = buildKillerAwarenessContract({
    killerAwareness: "self-aware",
    roleKey: "role-1",
    killerRoleKey: "role-3",
    actIndex: 0,
    finalActIndex: 2
  });
  assert.equal(c.isInnocent, true);
  assert.ok(c.rules.some((r) => r.includes("矛盾")));
});

test("buildKillerAwarenessContract self-unaware killer like innocent", () => {
  const c = buildKillerAwarenessContract({
    killerAwareness: "self-unaware",
    roleKey: "role-3",
    killerRoleKey: "role-3",
    actIndex: 0,
    finalActIndex: 2
  });
  assert.ok(c.rules.some((r) => r.includes("不自知")));
});

test("resolveLiteraryStyleKey accepts key and Chinese label", () => {
  assert.equal(resolveLiteraryStyleKey("minimal"), "minimal");
  assert.equal(resolveLiteraryStyleKey("电影感文风"), "cinematic");
  assert.equal(resolveLiteraryStyleKey("unknown"), "cinematic");
});

test("buildLiteraryStyleCard replaces tone/styleAnchor", () => {
  const card = buildLiteraryStyleCard({ literaryStyle: "horror", mysteryStyle: "holmes", pov: "second" });
  assert.equal(card.literaryStyle, "horror");
  assert.equal(card.mysteryStyle, "holmes");
  assert.ok(card.anchor.includes("福尔摩斯"));
  assert.ok(card.dialogueGuide?.register);
  assert.equal(card.tone, "");
  assert.equal(card.styleAnchor, "");
});

test("listLiteraryStyleOptions includes 12 presets", () => {
  assert.equal(listLiteraryStyleOptions().length, 12);
});

test("buildPublicActionBrief includes actOutline when provided", () => {
  const brief = buildPublicActionBrief({
    characterArchive: { name: "甲 · 律师", publicIdentity: "律师", voiceHints: "简短" },
    matrixRow: { tasks: ["观察众人"], lies: [] },
    actKey: "ch1",
    actIndex: 0,
    actOutline: {
      outline: "你进入大厅，听见潮声。",
      knowledgeSources: [{ fact: "大厅有人", source: "亲眼所见", clueId: null }]
    }
  });
  assert.ok(brief.actOutline.includes("大厅"));
  assert.equal(brief.knowledgeSources.length, 1);
  assert.ok(brief.rule.includes("actOutline"));
});

test("mechanicalTruthCompare checks killer roleKey", () => {
  const reconstruction = validateTruthReconstruction({
    inferred: { killer: "role-3", method: "x", confidence: 0.8 },
    comparison: { overallAligned: true, killerMatch: true, methodMatch: true, timelineConsistent: true },
    verdict: "pass"
  });
  const r = mechanicalTruthCompare(reconstruction, { killer: "role-3" });
  assert.equal(r.killerMatch, true);
  assert.equal(r.passed, true);
});

test("mechanicalTruthCompare fails on killer mismatch", () => {
  const reconstruction = validateTruthReconstruction({
    inferred: { killer: "role-1" },
    comparison: { overallAligned: false },
    verdict: "revise_outlines"
  });
  const r = mechanicalTruthCompare(reconstruction, { killer: "role-3" });
  assert.equal(r.passed, false);
});

test("mechanicalInnocentInferenceCompare killer match", () => {
  const inference = validateInnocentScriptsInference({
    inferred: { killer: "role-3", confidence: 0.82 },
    reasoningChain: [],
    gaps: []
  });
  const r = mechanicalInnocentInferenceCompare(inference, { killer: "role-3" });
  assert.equal(r.killerMatch, true);
  assert.ok(renderInnocentInferenceMarkdown({ inference, mechanical: r, killerRoleKey: "role-3" }).includes("非凶手剧本"));
});
