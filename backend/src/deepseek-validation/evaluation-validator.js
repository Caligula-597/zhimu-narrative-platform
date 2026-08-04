import { clampInteger, cleanText } from "../prompts/shared.js";

export function validateStoryEvaluation(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const scores = value.scores && typeof value.scores === "object" ? value.scores : {};
  const clampScore = (key, fallback = 7) => clampInteger(Number(scores[key]) * 10, 10, 100, fallback * 10) / 10;
  const normalizedScores = {
    playability: clampScore("playability"),
    fairness: clampScore("fairness"),
    multiRoleDesign: clampScore("multiRoleDesign"),
    pacing: clampScore("pacing"),
    graphReady: clampScore("graphReady"),
    consistency: clampScore("consistency"),
    styleFit: clampScore("styleFit")
  };
  const overall = clampInteger(Number(value.overallScore) * 10, 10, 100, 70) / 10;
  const validLayers = new Set(["setup", "spec", "narrative", "roles", "roleMatrix", "matrix", "section", "sync", "structure", "evaluate"]);
  const validPriority = new Set(["must_fix", "should_fix", "optional"]);
  const issues = Array.isArray(value.issues) ? value.issues.slice(0, 12).map((item) => ({
    severity: ["high", "medium", "low"].includes(item?.severity) ? item.severity : "medium",
    area: cleanText(item?.area, 80),
    detail: cleanText(item?.detail, 500)
  })) : [];
  const normalizeLayer = (layer) => {
    if (layer === "roleMatrix" || layer === "matrix" || layer === "section") return "roles";
    if (layer === "brief" || layer === "spec" || layer === "outline") return "setup";
    if (layer === "structure" || layer === "synopsis") return "sync";
    return layer;
  };
  const revisions = Array.isArray(value.revisions) ? value.revisions.slice(0, 16).map((item) => {
    const rawLayer = validLayers.has(item?.targetLayer) ? item.targetLayer : "narrative";
    return {
      targetLayer: normalizeLayer(rawLayer),
      targetKey: cleanText(item?.targetKey, 40) || null,
      priority: validPriority.has(item?.priority) ? item.priority : "should_fix",
      problem: cleanText(item?.problem, 400),
      direction: cleanText(item?.direction, 800),
      promptHint: cleanText(item?.promptHint, 500),
      preserve: cleanText(item?.preserve, 400)
    };
  }) : [];
  const priorityOrder = { must_fix: 0, should_fix: 1, optional: 2 };
  revisions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  const styleRaw = value.styleAlignment && typeof value.styleAlignment === "object" ? value.styleAlignment : {};
  const styleAlignment = {
    matchLevel: ["high", "medium", "low"].includes(styleRaw.matchLevel) ? styleRaw.matchLevel : "medium",
    summary: cleanText(styleRaw.summary, 800),
    keepEmphasis: Array.isArray(styleRaw.keepEmphasis) ? styleRaw.keepEmphasis.slice(0, 6).map((item) => cleanText(item, 300)) : [],
    adjustEmphasis: Array.isArray(styleRaw.adjustEmphasis) ? styleRaw.adjustEmphasis.slice(0, 6).map((item) => cleanText(item, 300)) : []
  };
  const nextStepOrder = Array.isArray(value.nextStepOrder)
    ? value.nextStepOrder.map((layer) => normalizeLayer(layer)).filter((layer) => validLayers.has(layer) || layer === "setup" || layer === "roles" || layer === "sync").slice(0, 6)
    : [...new Set(revisions.map((item) => item.targetLayer))].slice(0, 5);
  const hasMustFix = revisions.some((item) => item.priority === "must_fix");
  const hasHigh = issues.some((item) => item.severity === "high");
  return {
    overallScore: overall,
    verdict: cleanText(value.verdict, 600),
    scores: normalizedScores,
    styleAlignment,
    strengths: Array.isArray(value.strengths) ? value.strengths.slice(0, 8).map((item) => cleanText(item, 300)) : [],
    issues,
    revisions,
    nextStepOrder,
    recommendations: Array.isArray(value.recommendations) ? value.recommendations.slice(0, 10).map((item) => cleanText(item, 400)) : [],
    readyForImport: Boolean(value.readyForImport) && !hasMustFix && !hasHigh && overall >= 7
  };
}
