/**
 * P10.2 — StoryExperienceProfile accessors (no family-specific scoring here).
 */

import { STORY_EXPERIENCE_PROFILES, lookupStoryExperienceProfile } from "./story-experience-profiles-data.js";

export {
  EXPERIENCE_AXES,
  STRUCTURAL_COMMITMENTS,
  INTERACTION_MODES,
  EXPERIENCE_ANCHORS,
  RESOLUTION_PRESSURES,
  SPEC_EXPERIENCE_TO_AXIS,
  GAMEPLAY_TO_INTERACTION,
  COMMITMENT_TO_SPEC_KEY,
  WEAK_AGENCY_ACTION_KINDS,
  STRONG_AGENCY_ACTION_KINDS,
} from "./story-experience-constants.js";

export function getStoryExperienceProfile(templateId) {
  return lookupStoryExperienceProfile(templateId);
}

export function isExperienceProfileReady(templateId) {
  return getStoryExperienceProfile(templateId).status === "READY";
}

export function listCompleteExperienceTemplateIds() {
  return Object.freeze(Object.keys(STORY_EXPERIENCE_PROFILES));
}

export function unionProfileFields(profiles, field) {
  const out = new Set();
  for (const p of profiles || []) {
    for (const v of p?.[field] || []) out.add(v);
  }
  return [...out];
}
