/**
 * P9.4 Content Quality Gate V1 — report contract (read-only; never mutates Package).
 */

export const CONTENT_QUALITY_REPORT_VERSION = 1;
export const CONTENT_QUALITY_EVALUATOR_VERSION = "content-quality-v1";

export const CONTENT_QUALITY_STATUSES = Object.freeze([
  "QUALITY_BLOCKED",
  "REWRITE_REQUIRED",
  "QUALITY_REVIEW_REQUIRED",
  "BORDERLINE",
  "QUALITY_PASS",
  "EXCEPTIONAL_CANDIDATE",
]);

export const HARD_BLOCKER_TYPES = Object.freeze([
  "CANON_CONTRADICTION",
  "PRIVATE_INFO_LEAK",
  "ENDING_TRUTH_MISMATCH",
  "CLUE_LOGIC_BROKEN",
  "UNFAIR_REQUIRED_INFERENCE",
  "ROLE_HAS_NO_AGENCY",
  "GAME_RULE_NARRATIVE_MISMATCH",
  "DEAD_REQUIRED_GAME",
  "UNRESOLVED_PLACEHOLDER",
  "HOST_CANNOT_RUN",
  "MISSING_MAJOR_PAYOFF",
]);

export const AI_PATTERN_TYPES = Object.freeze([
  "GENERIC_EMOTION_EXPLANATION",
  "ABSTRACT_STAKES",
  "SAME_VOICE",
  "SIGNIFICANCE_RESTATEMENT",
  "FALSE_INTENSITY",
  "SYMMETRIC_ROLEBOOK",
  "GENRE_NOUN_SWAP",
  "EXPOSITION_DUPLICATION",
]);

/** @type {ReadonlyArray<{ id: string, label: string, weight: number }>} */
export const CONTENT_QUALITY_DIMENSIONS = Object.freeze([
  { id: "A_CHARACTER_AGENCY", label: "人物成立与玩家能动性", weight: 20 },
  { id: "B_INFORMATION_FAIRNESS", label: "信息设计、线索与公平推理", weight: 20 },
  { id: "C_STAGE_PROGRESSION", label: "剧情推进与幕间节奏", weight: 15 },
  { id: "D_GAME_NARRATIVE_FUSION", label: "GAME 与剧情融合", weight: 10 },
  { id: "E_AESTHETIC_VOICE", label: "文本审美、人物声音与世界质感", weight: 15 },
  { id: "F_ENDING_PAYOFF", label: "终局兑现与主题收束", weight: 10 },
  { id: "G_HOST_RUNNABILITY", label: "主持可运行性与成品效率", weight: 10 },
]);

export const QUALITY_PASS_FLOORS = Object.freeze({
  totalMin: 80,
  exceptionalMin: 90,
  rewriteBelow: 65,
  reviewBelow: 75,
  borderlineBelow: 80,
  A_CHARACTER_AGENCY: 3.5,
  B_INFORMATION_FAIRNESS: 3.5,
  C_STAGE_PROGRESSION: 3,
  D_GAME_NARRATIVE_FUSION: 3,
  E_AESTHETIC_VOICE: 3,
  F_ENDING_PAYOFF: 3,
  G_HOST_RUNNABILITY: 3,
});

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, maximum = 800) {
  return String(value ?? "").trim().slice(0, maximum);
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, Math.round(n * 2) / 2));
}

export function weightedDimensionScore(rawScore, weight) {
  return (clampScore(rawScore) / 5) * Number(weight || 0);
}

export function normalizeEvidence(list) {
  return asArray(list)
    .slice(0, 12)
    .map((row) => {
      const src = record(row);
      return {
        sectionId: cleanText(src.sectionId, 120) || undefined,
        roleId: cleanText(src.roleId, 80) || undefined,
        stageId: cleanText(src.stageId, 80) || undefined,
        clueId: cleanText(src.clueId, 80) || undefined,
        excerpt: cleanText(src.excerpt, 280) || undefined,
        observation: cleanText(src.observation, 400) || "（无观察）",
      };
    })
    .filter((e) => e.observation);
}

export function normalizeDimension(value = {}, fallbackId = "A_CHARACTER_AGENCY") {
  const src = record(value);
  const spec =
    CONTENT_QUALITY_DIMENSIONS.find((d) => d.id === src.id) ||
    CONTENT_QUALITY_DIMENSIONS.find((d) => d.id === fallbackId) ||
    CONTENT_QUALITY_DIMENSIONS[0];
  const score = clampScore(src.score);
  const weight = Number(src.weight ?? spec.weight) || spec.weight;
  return {
    id: spec.id,
    label: cleanText(src.label, 80) || spec.label,
    weight,
    score,
    weightedScore: Number.isFinite(Number(src.weightedScore))
      ? Number(src.weightedScore)
      : weightedDimensionScore(score, weight),
    rationale: cleanText(src.rationale, 1200) || "未提供评分理由。",
    whyNotHigher: cleanText(src.whyNotHigher, 800) || undefined,
    evidence: normalizeEvidence(src.evidence),
    strengths: asArray(src.strengths).map((s) => cleanText(s, 200)).filter(Boolean).slice(0, 6),
    weaknesses: asArray(src.weaknesses).map((s) => cleanText(s, 200)).filter(Boolean).slice(0, 6),
    highestPriorityFix: cleanText(src.highestPriorityFix, 280) || undefined,
  };
}

export function normalizeHardBlocker(value = {}) {
  const src = record(value);
  const type = HARD_BLOCKER_TYPES.includes(src.type) ? src.type : "CANON_CONTRADICTION";
  return {
    type,
    message: cleanText(src.message, 400) || type,
    sectionId: cleanText(src.sectionId, 120) || undefined,
    roleId: cleanText(src.roleId, 80) || undefined,
    stageId: cleanText(src.stageId, 80) || undefined,
    clueId: cleanText(src.clueId, 80) || undefined,
    evidence: normalizeEvidence(src.evidence),
  };
}

export function normalizeAiPattern(value = {}) {
  const src = record(value);
  const type = AI_PATTERN_TYPES.includes(src.type) ? src.type : "ABSTRACT_STAKES";
  return {
    type,
    count: Math.max(1, Math.trunc(Number(src.count) || 1)),
    message: cleanText(src.message, 280) || type,
    evidence: normalizeEvidence(src.evidence).slice(0, 4),
  };
}

export function normalizeRevisionPriority(value = {}, index = 0) {
  const src = record(value);
  return {
    priority: Math.max(1, Math.trunc(Number(src.priority) || index + 1)),
    summary: cleanText(src.summary, 280) || `优先项 ${index + 1}`,
    impacts: asArray(src.impacts).map((s) => cleanText(s, 80)).filter(Boolean).slice(0, 4),
    target: {
      sectionId: cleanText(src.target?.sectionId, 120) || undefined,
      roleId: cleanText(src.target?.roleId, 80) || undefined,
      stageId: cleanText(src.target?.stageId, 80) || undefined,
      clueId: cleanText(src.target?.clueId, 80) || undefined,
    },
  };
}

export function computeTotalFromDimensions(dimensions) {
  return asArray(dimensions).reduce((sum, d) => sum + Number(d.weightedScore || 0), 0);
}

/**
 * Resolve status from blockers + total + dimension floors.
 * @param {{ hardBlockers: object[], totalScore: number, dimensions: object[], hasGame?: boolean }} input
 */
export function resolveContentQualityStatus({
  hardBlockers = [],
  totalScore = 0,
  dimensions = [],
  hasGame = false,
} = {}) {
  if (asArray(hardBlockers).length) return "QUALITY_BLOCKED";

  const byId = Object.fromEntries(asArray(dimensions).map((d) => [d.id, d]));
  const floors = QUALITY_PASS_FLOORS;
  const scoreOf = (id) => Number(byId[id]?.score || 0);

  const floorsOk =
    scoreOf("A_CHARACTER_AGENCY") >= floors.A_CHARACTER_AGENCY &&
    scoreOf("B_INFORMATION_FAIRNESS") >= floors.B_INFORMATION_FAIRNESS &&
    scoreOf("C_STAGE_PROGRESSION") >= floors.C_STAGE_PROGRESSION &&
    (!hasGame || scoreOf("D_GAME_NARRATIVE_FUSION") >= floors.D_GAME_NARRATIVE_FUSION) &&
    scoreOf("E_AESTHETIC_VOICE") >= floors.E_AESTHETIC_VOICE &&
    scoreOf("F_ENDING_PAYOFF") >= floors.F_ENDING_PAYOFF &&
    scoreOf("G_HOST_RUNNABILITY") >= floors.G_HOST_RUNNABILITY;

  const total = Number(totalScore) || 0;
  if (total >= floors.exceptionalMin && floorsOk) return "EXCEPTIONAL_CANDIDATE";
  if (total >= floors.totalMin && floorsOk) return "QUALITY_PASS";
  if (total < floors.rewriteBelow) return "REWRITE_REQUIRED";
  if (total < floors.reviewBelow) return "QUALITY_REVIEW_REQUIRED";
  return "BORDERLINE";
}

export function normalizeContentQualityReport(value = {}) {
  const src = record(value);
  const dimensions = CONTENT_QUALITY_DIMENSIONS.map((spec) => {
    const found = asArray(src.dimensions).find((d) => d?.id === spec.id);
    return normalizeDimension({ ...spec, ...record(found) }, spec.id);
  });
  const hardBlockers = asArray(src.hardBlockers).map(normalizeHardBlocker);
  const totalScore =
    src.totalScore != null ? Number(src.totalScore) : computeTotalFromDimensions(dimensions);
  const hasGame = Boolean(src.hasGame);
  const status = CONTENT_QUALITY_STATUSES.includes(src.status)
    ? src.status
    : resolveContentQualityStatus({ hardBlockers, totalScore, dimensions, hasGame });

  return {
    version: CONTENT_QUALITY_REPORT_VERSION,
    packageId: cleanText(src.packageId, 120) || "package",
    packageRevision: Math.max(1, Math.trunc(Number(src.packageRevision) || 1)),
    evaluatorVersion: cleanText(src.evaluatorVersion, 80) || CONTENT_QUALITY_EVALUATOR_VERSION,
    rubricAdapterId: cleanText(src.rubricAdapterId, 80) || "heuristic-v1",
    hasGame,
    hardBlockers,
    deterministicFindings: asArray(src.deterministicFindings)
      .map((f) => ({
        code: cleanText(f?.code, 80) || "FINDING",
        severity: cleanText(f?.severity, 40) || "info",
        message: cleanText(f?.message, 400) || "",
        evidence: normalizeEvidence(f?.evidence),
      }))
      .filter((f) => f.message)
      .slice(0, 40),
    aiPatterns: asArray(src.aiPatterns).map(normalizeAiPattern).slice(0, 20),
    dimensions,
    totalScore: Math.round(totalScore * 10) / 10,
    status,
    topStrengths: asArray(src.topStrengths).map((s) => cleanText(s, 200)).filter(Boolean).slice(0, 5),
    topProblems: asArray(src.topProblems).map((s) => cleanText(s, 200)).filter(Boolean).slice(0, 5),
    revisionPriorities: asArray(src.revisionPriorities)
      .slice(0, 3)
      .map((p, i) => normalizeRevisionPriority(p, i)),
    evaluatedAt: src.evaluatedAt != null ? String(src.evaluatedAt) : null,
  };
}
