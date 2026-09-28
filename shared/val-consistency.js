/**
 * Val Consistency Ledger — shared types.
 *
 * A Val (一致性) record is NOT story content. It is a management ledger that
 * flags contradictory versions of the SAME fact referenced elsewhere in the
 * world, and drives the fact-version reconciliation:
 *
 *   未决(open) → 待裁决(pending) → 已统一(unified)
 *
 * Every record captures: which entry is involved, what contradicts, the two
 * conflicting versions, and the recommended resolution. Downstream tools can
 * surface these to prompt "you edited one version but not its related copy".
 */

/**
 * @typedef {Object} ValRecord
 * @property {string} id
 * @property {string} worldId
 * @property {string} title        — short label, e.g. "VAL-04"
 * @property {number} sequence     — ordering in the ledger
 * @property {string} referencesEntry — 涉及条目：哪个条目 / 哪一处被引用
 * @property {string} conflictDesc    — 冲突点：两版本在哪个事实上打架
 * @property {string} versionA        — 版本 A 原样记录
 * @property {string} versionB        — 版本 B 原样记录
 * @property {string} recommendation  — 建议以哪个为准 / 如何统一
 * @property {string} status          — 未决 / 待裁决 / 已统一
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export const VAL_EDITOR_VERSION = 1;

export const VAL_API_PREFIX = "/api/worlds/:worldId/val-records";

/** Lifecycle of a Val record, in order. */
export const VAL_STATUSES = ["未决", "待裁决", "已统一"];

/** Default empty draft for a new Val record. */
export function emptyValDraft() {
  return {
    title: "",
    sequence: 0,
    referencesEntry: "",
    conflictDesc: "",
    versionA: "",
    versionB: "",
    recommendation: "",
    status: "未决"
  };
}

/** Build a Val record for client-side use. */
export function buildValRecord(overrides = {}) {
  return {
    id: overrides.id || "",
    worldId: overrides.worldId || "",
    title: overrides.title || "",
    sequence: overrides.sequence || 0,
    referencesEntry: overrides.referencesEntry || "",
    conflictDesc: overrides.conflictDesc || "",
    versionA: overrides.versionA || "",
    versionB: overrides.versionB || "",
    recommendation: overrides.recommendation || "",
    status: overrides.status || "未决",
    createdAt: overrides.createdAt || "",
    updatedAt: overrides.updatedAt || ""
  };
}

/** Move a Val status to the next step; null when already final. */
export function nextValStatus(current = "未决") {
  const idx = VAL_STATUSES.indexOf(current);
  if (idx < 0 || idx === VAL_STATUSES.length - 1) return null;
  return VAL_STATUSES[idx + 1];
}