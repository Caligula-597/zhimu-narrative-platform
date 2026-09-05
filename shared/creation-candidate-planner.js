/**
 * P8.1 Story / Gameplay Candidate Planner — recommendations only, never auto-accept.
 * Scoring uses catalog creationMetadata × Spec experience (generic, no family if/else).
 */

import { EXPERIENCE_KEYS, normalizePlayableCreationSpec } from "./playable-creation-spec.js";
import { buildCreationConstraintEnvelope } from "./creation-constraint-envelope.js";
import { creationMetadataForTemplate } from "./creation-catalog-metadata.js";

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

/** Soft affinity only — never hard-filter by genre/era. */
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
 * @param {object} specInput
 * @param {Array<{ id: string, familyId?: string, contentMaturity?: string }>} templates
 */
export function planStoryCandidates(specInput, templates = []) {
  const spec = normalizePlayableCreationSpec(specInput);
  if (!spec) return null;
  const envelope = buildCreationConstraintEnvelope(spec);
  const avoid = new Set(asArray(spec.premise?.avoid).map((t) => String(t).toLowerCase()));

  const candidates = [];
  for (const tpl of templates) {
    if (!tpl?.id) continue;
    // Prefer COMPLETE maturity when available; foundations still allowed with lower base
    const meta = creationMetadataForTemplate(tpl.id, tpl.familyId);
    const maturity = tpl.contentMaturity || "FOUNDATION";
    let score = experienceDot(spec.experience, meta.experienceProfile);
    score += softSettingBoost(envelope, meta);
    if (maturity === "COMPLETE") score += 0.2;
    else score -= 0.05;

    const matchedIntents = asArray(meta.intentTags).filter((tag) => {
      const key = String(tag).toLowerCase();
      if (key.includes("faction") && spec.experience.faction >= 0.5) return true;
      if (key.includes("deduction") && spec.experience.deduction >= 0.5) return true;
      if (key.includes("identity") && (spec.experience.deduction >= 0.4 || spec.experience.roleplay >= 0.4))
        return true;
      if (key.includes("roleplay") && spec.experience.roleplay >= 0.5) return true;
      if (key.includes("emotional") && spec.experience.emotional >= 0.5) return true;
      return spec.experience[key] >= 0.55;
    });

    const warnings = [];
    if (avoid.size && asArray(meta.intentTags).some((t) => avoid.has(String(t).toLowerCase()))) {
      warnings.push("命中 premise.avoid 意图标签");
      score -= 0.5;
    }
    for (const tag of asArray(spec.gameplayPreferences?.avoid)) {
      // STORY planner ignores GAME avoid except soft note
      void tag;
    }

    const reasons = [
      `体验匹配 ${score.toFixed(2)}`,
      maturity === "COMPLETE" ? "COMPLETE 语义可用" : "catalog foundation",
      ...matchedIntents.map((t) => `意图 ${t}`),
    ];

    candidates.push({
      templateId: tpl.id,
      familyId: tpl.familyId || meta.familyId,
      score: Math.round(score * 1000) / 1000,
      reasons,
      matchedIntents,
      warnings,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.templateId.localeCompare(b.templateId));

  const top = candidates.slice(0, 12);
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
    sourceSpecRevision: spec.revision,
    candidates: top,
    coverage,
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

/** Combined plan for UI: story recommendations + gameplay intent hints. */
export function buildStoryCandidatePlan(specInput, templates = []) {
  const story = planStoryCandidates(specInput, templates);
  const gameplay = planGameplayCandidates(specInput);
  if (!story) return null;
  return {
    ...story,
    gameplayCandidates: gameplay?.candidates || [],
  };
}
