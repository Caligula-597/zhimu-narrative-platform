/**
 * Misidentification Editor — shared types for the misidentification register.
 *
 * A misidentification is a mistaken belief held by a character. It forms at a
 * point in time, can be bound to the clue / physical item that overthrows it,
 * and is displayed on a timeline (by act + timestamp).
 *
 * Data model:
 *   World → Acts → Misidentifications (holder, evidence bindings, status)
 */

/**
 * @typedef {Object} Misidentification
 * @property {string}  id
 * @property {string}  worldId
 * @property {string}  actId            — FK to chapter/act
 * @property {string}  timestamp        — exact ("17:00") or fuzzy ("傍晚") when it forms
 * @property {number}  sortOrder        — ordering within the act (timeline position)
 * @property {string}  holderId         — FK to role slot / character holding the belief ("" if none)
 * @property {string}  holderLabel      — persistent display name of the holder
 * @property {string}  title            — short label, e.g. "K-01"
 * @property {string}  content          — the mistaken belief
 * @property {string}  truth            — the actual fact that corrects it (optional)
 * @property {string}  refutedByClueId  — FK to clue that overthrows it ("" if none)
 * @property {string}  refutedByItemId  — FK to item / physical evidence ("" if none)
 * @property {string}  refutedAt        — exact/fuzzy time when it was overturned
 * @property {string}  duration         — how long the misID lasts, e.g. "17:40–19:30"
 * @property {boolean} isActive         — still held (live, red) vs refuted (grey)
 * @property {string}  createdAt
 * @property {string}  updatedAt
 */

/**
 * @typedef {Object} MisidentificationEditorState
 * @property {Misidentification[]} items
 * @property {string}              filterActId       — current act filter, "" = show all
 * @property {string|undefined}    filterActive      — "" / "true" / "false" status filter
 * @property {string|null}         editingId         — currently editing item, null = new
 * @property {Misidentification}   draft             — current draft for new/edit
 */

export const MISIDENTIFICATION_EDITOR_VERSION = 1;

export const MISIDENTIFICATION_API_PREFIX = "/api/worlds/:worldId/misidentifications";

/** Default empty draft for a new misidentification */
export function emptyMisidentificationDraft() {
  return {
    actId: "",
    timestamp: "",
    sortOrder: 0,
    holderId: "",
    holderLabel: "",
    title: "",
    content: "",
    truth: "",
    refutedByClueId: "",
    refutedByItemId: "",
    refutedAt: "",
    duration: "",
    isActive: true
  };
}

/**
 * Build a misidentification for client-side use.
 * @param {Partial<Misidentification>} overrides
 * @returns {Misidentification}
 */
export function buildMisidentification(overrides = {}) {
  return {
    id: overrides.id || "",
    worldId: overrides.worldId || "",
    actId: overrides.actId || "",
    timestamp: overrides.timestamp || "",
    sortOrder: overrides.sortOrder ?? 0,
    holderId: overrides.holderId || "",
    holderLabel: overrides.holderLabel || "",
    title: overrides.title || "",
    content: overrides.content || "",
    truth: overrides.truth || "",
    refutedByClueId: overrides.refutedByClueId || "",
    refutedByItemId: overrides.refutedByItemId || "",
    refutedAt: overrides.refutedAt || "",
    duration: overrides.duration || "",
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt || "",
    updatedAt: overrides.updatedAt || ""
  };
}