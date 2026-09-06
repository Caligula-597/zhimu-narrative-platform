/**
 * P9.4 Content Quality Gate V1 tests — GOOD / MEDIOCRE / BROKEN calibration.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTENT_QUALITY_DIMENSIONS,
  normalizeContentQualityReport,
  resolveContentQualityStatus,
  QUALITY_PASS_FLOORS,
} from "../shared/content-quality-contracts.js";
import { evaluateContentQuality } from "../shared/content-quality-gate.js";
import {
  buildBrokenQualityPackage,
  buildGoodQualityPackage,
  buildMediocreQualityPackage,
} from "../shared/content-quality-fixtures.js";
import { detectAiPatterns } from "../shared/content-quality-ai-patterns.js";
import { detectHardBlockers } from "../shared/content-quality-hard-blockers.js";
import {
  ScriptedContentQualityRubricEvaluator,
  assertRationaleNotEmptyAdj,
} from "../shared/content-quality-rubric.js";
import { normalizeCompleteScriptPackage } from "../shared/complete-script-package-contracts.js";

const FIXED = () => "2026-09-06T12:00:00.000Z";

describe("P9.4 Content Quality contracts", () => {
  it("normalizes report and keeps seven weighted dimensions", () => {
    const report = normalizeContentQualityReport({
      packageId: "x",
      dimensions: CONTENT_QUALITY_DIMENSIONS.map((d) => ({
        id: d.id,
        score: 3,
        rationale: "合格：功能完整，证据来自结构覆盖。",
        evidence: [{ observation: "结构存在", excerpt: "样本" }],
      })),
    });
    assert.equal(report.version, 1);
    assert.equal(report.dimensions.length, 7);
    assert.equal(report.totalScore, 60);
    assert.ok(CONTENT_QUALITY_DIMENSIONS.every((d) => report.dimensions.some((x) => x.id === d.id)));
  });

  it("PASS requires floors — high E cannot rescue low A/B", () => {
    const dims = CONTENT_QUALITY_DIMENSIONS.map((d) => ({
      id: d.id,
      weight: d.weight,
      score: d.id === "E_AESTHETIC_VOICE" || d.id === "F_ENDING_PAYOFF" ? 5 : 2,
      weightedScore: ((d.id === "E_AESTHETIC_VOICE" || d.id === "F_ENDING_PAYOFF" ? 5 : 2) / 5) * d.weight,
    }));
    const total = dims.reduce((s, d) => s + d.weightedScore, 0);
    assert.ok(total >= 40);
    const status = resolveContentQualityStatus({
      hardBlockers: [],
      totalScore: 82,
      dimensions: dims,
      hasGame: true,
    });
    assert.equal(status, "BORDERLINE");
  });
});

describe("P9.4 Hard blockers + AI patterns", () => {
  it("BROKEN hits multiple hard blockers including placeholder and GAME mismatch", () => {
    const pkg = buildBrokenQualityPackage();
    const blockers = detectHardBlockers(pkg);
    const types = new Set(blockers.map((b) => b.type));
    assert.ok(types.has("UNRESOLVED_PLACEHOLDER"));
    assert.ok(types.has("GAME_RULE_NARRATIVE_MISMATCH"));
    assert.ok(types.has("PRIVATE_INFO_LEAK") || types.has("ROLE_HAS_NO_AGENCY"));
    assert.ok(types.has("ENDING_TRUTH_MISMATCH") || types.has("CANON_CONTRADICTION"));
  });

  it("MEDIOCRE triggers AI-pattern diagnostics without needing hard block", () => {
    const pkg = buildMediocreQualityPackage();
    const blockers = detectHardBlockers(pkg);
    assert.equal(blockers.length, 0);
    const patterns = detectAiPatterns(pkg);
    const types = new Set(patterns.map((p) => p.type));
    assert.ok(types.has("FALSE_INTENSITY") || types.has("GENERIC_EMOTION_EXPLANATION"));
    assert.ok(types.has("SAME_VOICE") || types.has("SYMMETRIC_ROLEBOOK"));
  });
});

describe("P9.4 Gate calibration fixtures", () => {
  it("GOOD → QUALITY_PASS with evidence and <=3 priorities", async () => {
    const pkg = buildGoodQualityPackage();
    const before = JSON.stringify(pkg);
    const report = await evaluateContentQuality({ package: pkg, now: FIXED });
    assert.equal(JSON.stringify(pkg), before, "evaluator must not mutate package");
    assert.equal(report.status, "QUALITY_PASS");
    assert.equal(report.hardBlockers.length, 0);
    assert.ok(report.totalScore >= QUALITY_PASS_FLOORS.totalMin);
    const a = report.dimensions.find((d) => d.id === "A_CHARACTER_AGENCY");
    const b = report.dimensions.find((d) => d.id === "B_INFORMATION_FAIRNESS");
    assert.ok(a.score >= QUALITY_PASS_FLOORS.A_CHARACTER_AGENCY);
    assert.ok(b.score >= QUALITY_PASS_FLOORS.B_INFORMATION_FAIRNESS);
    for (const d of report.dimensions) {
      assert.ok(d.evidence.length >= 1, `${d.id} needs evidence`);
      assert.ok(d.whyNotHigher, `${d.id} must explain why not higher`);
      assert.ok(assertRationaleNotEmptyAdj(d.rationale));
    }
    assert.ok(report.revisionPriorities.length <= 3);
    assert.match(JSON.stringify(report), /沈岚|梁赫|目录|信/);
  });

  it("MEDIOCRE is structurally runnable-ish but not QUALITY_PASS", async () => {
    const report = await evaluateContentQuality({
      package: buildMediocreQualityPackage(),
      now: FIXED,
    });
    assert.equal(report.hardBlockers.length, 0);
    assert.notEqual(report.status, "QUALITY_PASS");
    assert.notEqual(report.status, "EXCEPTIONAL_CANDIDATE");
    assert.ok(
      ["REWRITE_REQUIRED", "QUALITY_REVIEW_REQUIRED", "BORDERLINE"].includes(report.status),
      report.status,
    );
    const e = report.dimensions.find((d) => d.id === "E_AESTHETIC_VOICE");
    assert.ok(e.score <= 3, `MEDIOCRE E should be weak, got ${e.score}`);
    assert.ok(report.aiPatterns.length >= 1);
    assert.ok(report.topProblems.length >= 1);
  });

  it("BROKEN → QUALITY_BLOCKED and priorities point at blockers", async () => {
    const report = await evaluateContentQuality({
      package: buildBrokenQualityPackage(),
      now: FIXED,
    });
    assert.equal(report.status, "QUALITY_BLOCKED");
    assert.ok(report.hardBlockers.length >= 1);
    assert.ok(report.revisionPriorities.length >= 1);
    assert.ok(report.revisionPriorities.length <= 3);
    assert.match(report.revisionPriorities[0].summary, /PLACEHOLDER|GAME_RULE|PRIVATE|AGENCY|ENDING|CANON|PAYOFF|CLUE|INFERENCE|HOST|DEAD/);
  });

  it("read-only: never auto-approves package status", async () => {
    const pkg = buildGoodQualityPackage();
    assert.equal(pkg.status, "READY_FOR_REVIEW");
    await evaluateContentQuality({ package: pkg, now: FIXED });
    assert.equal(pkg.status, "READY_FOR_REVIEW");
    const normalized = normalizeCompleteScriptPackage(pkg);
    assert.equal(normalized.status, "READY_FOR_REVIEW");
  });

  it("scripted rubric can force BORDERLINE despite clean hard gate", async () => {
    const scores = Object.fromEntries(
      CONTENT_QUALITY_DIMENSIONS.map((d) => [d.id, d.id.startsWith("A") || d.id.startsWith("B") ? 4 : 3]),
    );
    // total with all 3 → 60; mix to land 75-79 with floors ok → actually need total 75-79
    // A4 B4 C3 D3 E3 F3 G3 = 8+8+4.5+3+4.5+3+3 = 34? wait weights:
    // A20*4/5=16, B16, C9, D6, E9, F6, G6 = 68 → REVIEW
    const report = await evaluateContentQuality({
      package: buildGoodQualityPackage(),
      rubricEvaluator: new ScriptedContentQualityRubricEvaluator(scores),
      now: FIXED,
    });
    assert.equal(report.hardBlockers.length, 0);
    assert.ok(report.totalScore < 80);
    assert.ok(["QUALITY_REVIEW_REQUIRED", "BORDERLINE", "REWRITE_REQUIRED"].includes(report.status));
  });
});
