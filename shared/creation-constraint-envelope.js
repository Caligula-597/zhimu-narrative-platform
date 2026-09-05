/**
 * P8.1 CreationConstraintEnvelope — deterministic projection of PlayableCreationSpec.
 * Visible recommendations; no hidden stage magic.
 */

import {
  EXPERIENCE_KEYS,
  normalizePlayableCreationSpec,
  SUPPORTED_STAGE_COUNTS,
} from "./playable-creation-spec.js";

/**
 * V1: AUTO always recommends 4 acts (no duration→drama theory).
 * Policy isolated so it can change later without Spec contract churn.
 */
export function resolveRecommendedStageCount(_spec) {
  return {
    count: 4,
    source: "SYSTEM_RECOMMENDATION",
    reason: "当前默认推荐 4 幕，可修改。",
  };
}

function roleSlotConstraints(spec) {
  const policy = spec.roleConfiguration?.genderPolicy || "ANY";
  if (policy === "FIXED_COUNTS") {
    const fc = spec.roleConfiguration.fixedCounts || {};
    const slots = [];
    for (let i = 0; i < (fc.male || 0); i += 1) {
      slots.push({ slotId: `male-${i + 1}`, gender: "MALE" });
    }
    for (let i = 0; i < (fc.female || 0); i += 1) {
      slots.push({ slotId: `female-${i + 1}`, gender: "FEMALE" });
    }
    for (let i = 0; i < (fc.any || 0); i += 1) {
      slots.push({ slotId: `any-${i + 1}`, gender: "ANY" });
    }
    return slots;
  }
  if (policy === "AUTHOR_DEFINED") {
    return (spec.roleConfiguration.authorDefinedSlots || []).map((s) => ({
      slotId: s.slotId,
      gender: s.gender,
      label: s.label,
    }));
  }
  return Array.from({ length: spec.playerCount }, (_, i) => ({
    slotId: `role-${i + 1}`,
    gender: "ANY",
  }));
}

/**
 * @returns {object | null}
 */
export function buildCreationConstraintEnvelope(specInput) {
  const spec = normalizePlayableCreationSpec(specInput);
  if (!spec) return null;

  let resolvedStageCount;
  let stageCountResolution;
  if (spec.stagePreference.mode === "EXACT") {
    resolvedStageCount = spec.stagePreference.count;
    stageCountResolution = {
      source: "USER_EXACT",
      reason: `用户指定 ${resolvedStageCount} 幕`,
    };
  } else {
    const rec = resolveRecommendedStageCount(spec);
    resolvedStageCount = rec.count;
    stageCountResolution = {
      source: rec.source,
      reason: rec.reason,
    };
  }

  if (!SUPPORTED_STAGE_COUNTS.includes(resolvedStageCount)) {
    return null;
  }

  return {
    sourceSpecId: spec.id,
    sourceSpecRevision: spec.revision,
    playerCount: spec.playerCount,
    resolvedStageCount,
    stageCountResolution,
    roleSlotConstraints: roleSlotConstraints(spec),
    settingTags: [
      spec.setting.era,
      ...(spec.setting.customLabel ? [spec.setting.customLabel] : []),
    ],
    genreTags: [...(spec.genreTags || [])],
    experienceProfile: Object.fromEntries(
      EXPERIENCE_KEYS.map((k) => [k, spec.experience[k]]),
    ),
    gameplayIntentTags: [...(spec.gameplayPreferences?.preferred || [])],
    avoidGameplayIntentTags: [...(spec.gameplayPreferences?.avoid || [])],
    premise: {
      shortIdea: spec.premise?.shortIdea,
      mustKeep: [...(spec.premise?.mustKeep || [])],
      avoid: [...(spec.premise?.avoid || [])],
    },
  };
}
