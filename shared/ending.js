/**
 * Ending Branch Editor — shared types.
 *
 * An ending branch defines a possible outcome: a title, the trigger condition
 * that leads to it, the resulting text, and the extra clues / physical items
 * revealed when it is reached.
 */

/**
 * @typedef {Object} EndingBranch
 * @property {string}  id
 * @property {string}  worldId
 * @property {string}  title          — short label, e.g. "X-01"
 * @property {string}  trigger        — condition that leads to this ending
 * @property {string}  result         — ending result text
 * @property {string}  revealText     — additional information revealed
 * @property {string[]} revealClueIds — clues unlocked at this ending
 * @property {string[]} revealItemIds — physical items unlocked at this ending
 * @property {boolean} isGood         — good vs bad ending flag
 * @property {number}  sortOrder
 * @property {string}  createdAt
 * @property {string}  updatedAt
 */

export const ENDING_EDITOR_VERSION = 1;

export const ENDING_API_PREFIX = "/api/worlds/:worldId/endings";

/** Default empty draft for a new ending */
export function emptyEndingDraft() {
  return {
    title: "",
    trigger: "",
    result: "",
    revealText: "",
    revealClueIds: [],
    revealItemIds: [],
    isGood: true,
    sortOrder: 0
  };
}

/** Build an ending for client-side use. */
export function buildEnding(overrides = {}) {
  return {
    id: overrides.id || "",
    worldId: overrides.worldId || "",
    title: overrides.title || "",
    trigger: overrides.trigger || "",
    result: overrides.result || "",
    revealText: overrides.revealText || "",
    revealClueIds: overrides.revealClueIds || [],
    revealItemIds: overrides.revealItemIds || [],
    isGood: overrides.isGood ?? true,
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: overrides.createdAt || "",
    updatedAt: overrides.updatedAt || ""
  };
}

/** Toggle an id in an id array (used by the reveal clue/item lists). */
export function toggleId(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}