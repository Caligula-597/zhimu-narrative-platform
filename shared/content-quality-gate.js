/**
 * P9.4 Content Quality Gate — Hard blockers + deterministic checks + rubric → Report.
 * READ-ONLY: never mutates Package, never calls Writer, never auto-approves.
 */

import {
  CONTENT_QUALITY_EVALUATOR_VERSION,
  computeTotalFromDimensions,
  normalizeContentQualityReport,
  normalizeRevisionPriority,
  resolveContentQualityStatus,
} from "./content-quality-contracts.js";
import { detectAiPatterns } from "./content-quality-ai-patterns.js";
import { runDeterministicQualityChecks } from "./content-quality-deterministic-checks.js";
import { detectHardBlockers } from "./content-quality-hard-blockers.js";
import { packageHasGameSurface } from "./content-quality-package-text.js";
import { HeuristicContentQualityRubricEvaluator } from "./content-quality-rubric.js";
import { normalizeCompleteScriptPackage } from "./complete-script-package-contracts.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildRevisionPriorities(dimensions, hardBlockers) {
  if (asArray(hardBlockers).length) {
    return asArray(hardBlockers)
      .slice(0, 3)
      .map((b, i) =>
        normalizeRevisionPriority(
          {
            priority: i + 1,
            summary: `${b.type}: ${b.message}`,
            impacts: ["Hard Gate"],
            target: {
              sectionId: b.sectionId,
              roleId: b.roleId,
              stageId: b.stageId,
              clueId: b.clueId,
            },
          },
          i,
        ),
      );
  }

  const ranked = asArray(dimensions)
    .slice()
    .sort((a, b) => Number(a.score) - Number(b.score) || Number(b.weight) - Number(a.weight))
    .filter((d) => Number(d.score) < 4);

  const out = [];
  for (const d of ranked) {
    if (out.length >= 3) break;
    const ev = d.evidence?.[0] || {};
    out.push(
      normalizeRevisionPriority(
        {
          priority: out.length + 1,
          summary: d.highestPriorityFix || d.weaknesses?.[0] || `${d.label} 需上修至合格以上`,
          impacts: [d.label],
          target: {
            sectionId: ev.sectionId,
            roleId: ev.roleId,
            stageId: ev.stageId,
            clueId: ev.clueId,
          },
        },
        out.length,
      ),
    );
  }
  return out;
}

function buildTopLists(dimensions, hardBlockers, aiPatterns) {
  const topProblems = [];
  for (const b of asArray(hardBlockers).slice(0, 3)) {
    topProblems.push(`${b.type}: ${b.message}`);
  }
  for (const d of asArray(dimensions)
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)) {
    if (d.score < 4 && d.weaknesses?.[0]) topProblems.push(`${d.label}: ${d.weaknesses[0]}`);
  }
  for (const p of asArray(aiPatterns).slice(0, 2)) {
    topProblems.push(`AI_PATTERN ${p.type}`);
  }

  const topStrengths = asArray(dimensions)
    .filter((d) => d.score >= 4 && d.strengths?.[0])
    .slice(0, 5)
    .map((d) => `${d.label}: ${d.strengths[0]}`);

  return {
    topStrengths: [...new Set(topStrengths)].slice(0, 5),
    topProblems: [...new Set(topProblems)].slice(0, 5),
  };
}

/**
 * @param {{
 *   package: object,
 *   rubricEvaluator?: { evaluateDimensions: Function, adapterId?: string },
 *   hardBlockerOptions?: object,
 *   now?: () => string,
 * }} input
 */
export async function evaluateContentQuality(input = {}) {
  const raw = input.package || {};
  const normalized = normalizeCompleteScriptPackage(raw);
  // qualityHints is eval-only metadata (not Canon); preserve for scanners, never write back.
  const pkg = {
    ...normalized,
    qualityHints:
      raw.qualityHints && typeof raw.qualityHints === "object" && !Array.isArray(raw.qualityHints)
        ? raw.qualityHints
        : undefined,
  };
  // Snapshot identity for staleness tracking — do not write back.
  const packageId = pkg.id;
  const packageRevision = pkg.metadata?.revision || pkg.revision || 1;

  const hardBlockers = detectHardBlockers(pkg, input.hardBlockerOptions || {});
  const deterministicFindings = runDeterministicQualityChecks(pkg);
  const aiPatterns = detectAiPatterns(pkg);
  const hasGame = packageHasGameSurface(pkg);

  const rubric =
    input.rubricEvaluator ||
    new HeuristicContentQualityRubricEvaluator();
  const rubricResult = await rubric.evaluateDimensions(pkg, {
    aiPatterns,
    deterministicFindings,
    hardBlockers,
  });
  const dimensions = asArray(rubricResult?.dimensions);
  const totalScore = computeTotalFromDimensions(dimensions);
  const status = resolveContentQualityStatus({
    hardBlockers,
    totalScore,
    dimensions,
    hasGame,
  });
  const { topStrengths, topProblems } = buildTopLists(dimensions, hardBlockers, aiPatterns);
  const revisionPriorities = buildRevisionPriorities(dimensions, hardBlockers);
  const now = typeof input.now === "function" ? input.now() : new Date().toISOString();

  return normalizeContentQualityReport({
    packageId,
    packageRevision,
    evaluatorVersion: CONTENT_QUALITY_EVALUATOR_VERSION,
    rubricAdapterId: rubricResult?.adapterId || rubric.adapterId || "heuristic-v1",
    hasGame,
    hardBlockers,
    deterministicFindings,
    aiPatterns,
    dimensions,
    totalScore,
    status,
    topStrengths,
    topProblems,
    revisionPriorities,
    evaluatedAt: now,
  });
}

/** Convenience: sync-looking helper for tests that only need heuristic path. */
export function evaluateContentQualityHeuristic(pkg, opts = {}) {
  return evaluateContentQuality({
    package: pkg,
    rubricEvaluator: new HeuristicContentQualityRubricEvaluator(),
    ...opts,
  });
}
