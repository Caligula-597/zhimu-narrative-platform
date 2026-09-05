/**
 * P9.2 GAME narrative metadata — M03/M09 only (V1).
 * Other families remain candidate hints → NARRATIVE_RUNTIME_UNSUPPORTED.
 */

import { GAME_NARRATIVE_SUPPORTED_FAMILIES } from "./game-narrative-plan.js";

export const GAME_NARRATIVE_FAMILY_META = Object.freeze({
  M03: Object.freeze({
    kind: "MID_STORY_GAME",
    defaultTemplateId: "M03-1",
    requiresDownstreamContent: true,
    defaultStakeContextKey: "contestedResource",
    forbiddenStakeLabels: Object.freeze(["关键资源", "资源", "某物"]),
  }),
  M09: Object.freeze({
    kind: "FINAL_SETTLEMENT_GAME",
    defaultTemplateId: "M09-1",
    requiresDownstreamContent: false,
    requiresEndingSettlement: true,
    defaultStakeContextKey: null,
    forbiddenStakeLabels: Object.freeze(["关键资源"]),
  }),
});

export function isGameNarrativeFamilySupported(familyId) {
  return GAME_NARRATIVE_SUPPORTED_FAMILIES.includes(String(familyId || ""));
}

export function gameNarrativeFamilyMeta(familyId) {
  return GAME_NARRATIVE_FAMILY_META[String(familyId || "")] || null;
}

/**
 * Resolve stake label: Explicit binding label > Context profile > metadata fallback.
 */
export function resolveNarrativeStakeLabel({
  binding = null,
  contextProfile = null,
  fallbackLabel = null,
} = {}) {
  const explicit = binding?.narrative?.stake?.label;
  if (explicit && !isGenericStakeLabel(explicit)) return { label: explicit, source: "BINDING_EXPLICIT" };

  const key = binding?.narrative?.stake?.contextBindingKey;
  const fromCtx = key && contextProfile?.bindings?.[key]?.label;
  if (fromCtx) return { label: fromCtx, source: "CONTEXT_PROFILE" };

  const meta = gameNarrativeFamilyMeta(binding?.familyId);
  const metaKey = meta?.defaultStakeContextKey;
  const fromMetaCtx = metaKey && contextProfile?.bindings?.[metaKey]?.label;
  if (fromMetaCtx) return { label: fromMetaCtx, source: "CONTEXT_DEFAULT_KEY" };

  if (fallbackLabel && !isGenericStakeLabel(fallbackLabel)) {
    return { label: fallbackLabel, source: "METADATA_FALLBACK" };
  }
  return { label: explicit || fallbackLabel || "关键资源", source: "UNRESOLVED" };
}

export function isGenericStakeLabel(label) {
  const s = String(label || "").trim();
  if (!s) return true;
  return ["关键资源", "资源", "某物", "关键权限", "某个东西"].includes(s);
}
