/**
 * Timeline Editor — shared types for multi-line parallel action timeline.
 *
 * Data model:
 *   World → Acts → TimelineEntries → Cognitions
 *
 * Each TimelineEntry belongs to one act and one parallel line.
 * Each entry has actions (what the character does) and cognitions
 * (what the character knows/believes at that point).
 */

/**
 * @typedef {Object} TimelineEntry
 * @property {string}                    id
 * @property {string}                    worldId
 * @property {string}                    actId         — FK to chapter/act
 * @property {string}                    timestamp     — "17:00" or "傍晚" or "第二日清晨"
 * @property {number}                    sortOrder     — ordering within the act
 * @property {number}                    parallelLine  — 0, 1, 2, … each line is a parallel track
 * @property {string}                    actorId       — FK to role slot / character
 * @property {string}                    action        — what the character does
 * @property {string}                    impact        — what impact this action has on the world
 * @property {CognitionItem[]}           cognitions    — what the character knows/believes
 * @property {string}                    createdAt
 * @property {string}                    updatedAt
 */

/**
 * @typedef {Object} CognitionItem
 * @property {string}  id
 * @property {string}  characterId   — which character holds this cognition
 * @property {string}  content       — the cognition text
 * @property {boolean} isMisleading  — false = correct (black), true = misleading (red)
 */

/**
 * @typedef {Object} TimelineEditorState
 * @property {TimelineEntry[]} entries
 * @property {string}          filterActId       — current act filter, "" = show all
 * @property {number}          maxParallelLines  — how many parallel lines exist
 * @property {string|null}     editingEntryId    — currently editing entry, null = new entry
 * @property {Object}          draft             — current draft for new/edit entry
 */

export const TIMELINE_EDITOR_VERSION = 1;

export const TIMELINE_API_PREFIX = "/api/worlds/:worldId/timeline";

/** Max parallel lines supported in the UI */
export const MAX_PARALLEL_LINES = 6;

/** Default empty draft for a new timeline entry */
export function emptyTimelineDraft() {
  return {
    actId: "",
    timestamp: "",
    sortOrder: 0,
    parallelLine: 0,
    actorId: "",
    action: "",
    impact: "",
    cognitions: []
  };
}

/** Create a new cognition item */
export function createCognition(characterId = "", content = "", isMisleading = false) {
  return { id: "", characterId, content, isMisleading };
}

/**
 * Build a timeline entry for client-side use.
 * @param {Partial<TimelineEntry>} overrides
 * @returns {TimelineEntry}
 */
export function buildTimelineEntry(overrides = {}) {
  return {
    id: overrides.id || "",
    worldId: overrides.worldId || "",
    actId: overrides.actId || "",
    timestamp: overrides.timestamp || "",
    sortOrder: overrides.sortOrder ?? 0,
    parallelLine: overrides.parallelLine ?? 0,
    actorId: overrides.actorId || "",
    action: overrides.action || "",
    impact: overrides.impact || "",
    cognitions: overrides.cognitions || [],
    createdAt: overrides.createdAt || "",
    updatedAt: overrides.updatedAt || ""
  };
}