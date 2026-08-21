import { throwErr } from "./api-errors.js";

export const CONTENT_PACKAGE_JSON_BODY_LIMIT_BYTES = 16 * 1024 * 1024;
// Import currently performs reference-aware writes per entity. Keep the total
// below a level that can monopolize one database connection for minutes.
export const CONTENT_PACKAGE_MAX_TOTAL_ENTITIES = 5_000;

export const CONTENT_PACKAGE_COLLECTION_LIMITS = Object.freeze({
  roles: 500,
  chapters: 1_000,
  sections: 8_000,
  scenes: 8_000,
  clues: 12_000,
  investigationPoints: 12_000,
  rules: 5_000,
  items: 12_000,
  edges: 20_000,
  segmentRefs: 12_000,
  truthClaims: 8_000,
  roleRelationships: 12_000,
  roleArchives: 1_000,
  foreshadowBeats: 12_000,
  timelineEvents: 12_000,
  creatorReviews: 12_000,
  materialBooklets: 1_000,
  miniGameTemplates: 50
});

export function assertContentPackageWithinLimits(payload) {
  let total = 0;
  for (const [field, maximum] of Object.entries(CONTENT_PACKAGE_COLLECTION_LIMITS)) {
    const value = payload?.[field];
    if (value == null) continue;
    if (!Array.isArray(value) || value.length > maximum) {
      throwErr("CONTENT_PACKAGE_TOO_LARGE", `${field} exceeds the supported package limit`);
    }
    total += value.length;
  }
  if (total > CONTENT_PACKAGE_MAX_TOTAL_ENTITIES) {
    throwErr("CONTENT_PACKAGE_TOO_LARGE", `Content package contains ${total} entities; maximum is ${CONTENT_PACKAGE_MAX_TOTAL_ENTITIES}`);
  }
  return { total };
}
