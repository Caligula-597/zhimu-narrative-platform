/**
 * P8.1 / P10.2 Story Candidate Planner — recommendations only, never auto-accept.
 * P10.2: bundle-level Creation Intent Fidelity; family diversity is tie-breaker only.
 */

import { EXPERIENCE_KEYS, normalizePlayableCreationSpec } from "./playable-creation-spec.js";
import { buildCreationConstraintEnvelope } from "./creation-constraint-envelope.js";
import { creationMetadataForTemplate } from "./creation-catalog-metadata.js";
import { planCreationIntentStoryBundles } from "./creation-intent-bundle-planner.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function experienceDot(specExp, metaExp) {
  let score = 0;
  let weight = 0;
  for (const k of EXPERIENCE_KEYS) {
    const s = Number(specExp?.[k]) || 0;
    const m = Number(metaExp?.[k]) || 0;
    score += s * m;
    weight += s;
  }
  if (weight <= 0) return 0.15;
  return score / Math.max(weight, 0.01);
}

function softSettingBoost(envelope, meta) {
  const tags = new Set([...(envelope.genreTags || []), ...(envelope.settingTags || [])].map(String));
  const soft = asArray(meta?.softSettingTags);
  if (!soft.length || !tags.size) return 0;
  let hit = 0;
  for (const t of soft) if (tags.has(t)) hit += 1;
  return Math.min(0.15, hit * 0.05);
}

/**
 * Internal map: user gameplay intent → GAME catalog family hints (not shown in UI).
 */
export const GAMEPLAY_INTENT_TO_FAMILIES = Object.freeze({
  BIDDING: ["M03"],
  VOTING: ["M09"],
  TRANSFER: ["M04"],
  TIMED_TASK: ["M05"],
  SEALED_CHOICE: ["M06"],
  RESOURCE_COMPETITION: ["M03", "M05"],
  NEGOTIATION: ["M04", "M06"],
});

/**
 * Legacy individual candidate list (compat). Prefer buildStoryCandidatePlan for P10.2 fields.
 * @param {object} specInput
 * @param {Array<{ id: string, familyId?: string, contentMaturity?: string }>} templates
 * @param {{ authorConfirmedExperienceAnchors?: object[] }} [opts]
 */
export function planStoryCandidates(specInput, templates = [], opts = {}) {
  const bundled = planCreationIntentStoryBundles(specInput, templates, opts);
  if (!bundled) return null;

  // Keep a soft legacy coverage map for older callers
  const top = bundled.candidates;
  const coverage = Object.fromEntries(
    EXPERIENCE_KEYS.map((k) => {
      const hits = top.filter((c) => {
        const meta = creationMetadataForTemplate(c.templateId, c.familyId);
        return (meta.experienceProfile?.[k] || 0) >= 0.4;
      });
      return [k, Math.min(1, hits.length / 3)];
    }),
  );

  return {
    sourceSpecRevision: bundled.sourceSpecRevision,
    candidates: top.map((c) => ({
      templateId: c.templateId,
      familyId: c.familyId,
      score: c.fidelityScore,
      reasons: c.reasons,
      matchedIntents: c.matchedIntents,
      warnings: c.warnings,
      fidelityScore: c.fidelityScore,
      provides: c.provides,
      mismatchPenalties: c.mismatchPenalties,
    })),
    coverage,
    intentEnvelope: bundled.intentEnvelope,
    bundles: bundled.bundles,
    recommendedBundle: bundled.recommendedBundle,
    recommendationStatus: bundled.recommendationStatus,
    coverageGaps: bundled.coverageGaps,
  };
}

export function planGameplayCandidates(specInput) {
  const spec = normalizePlayableCreationSpec(specInput);
  if (!spec) return null;
  const preferred = asArray(spec.gameplayPreferences?.preferred);
  const avoid = new Set(asArray(spec.gameplayPreferences?.avoid));
  const rows = [];
  for (const intent of preferred) {
    if (avoid.has(intent)) continue;
    const families = GAMEPLAY_INTENT_TO_FAMILIES[intent] || [];
    rows.push({
      intentTag: intent,
      internalFamilyHints: families,
      reasons: [`用户偏好「${intent}」→ 内部候选族 ${families.join("/") || "（待 catalog）"}`],
      warnings: [
        "P8.1 仅保留意图与候选提示；不做 stage placement / OutcomeBinding / Runtime",
      ],
    });
  }
  return {
    sourceSpecRevision: spec.revision,
    candidates: rows,
  };
}

/** Combined plan for UI: story recommendations + gameplay intent hints + P10.2 bundles. */
export function buildStoryCandidatePlan(specInput, templates = [], opts = {}) {
  const story = planStoryCandidates(specInput, templates, opts);
  const gameplay = planGameplayCandidates(specInput);
  if (!story) return null;
  return {
    ...story,
    gameplayCandidates: gameplay?.candidates || [],
  };
}

export { softSettingBoost, experienceDot, buildCreationConstraintEnvelope };
