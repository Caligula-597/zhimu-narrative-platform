/**
 * Object Lifecycle Editor — shared types.
 *
 * An object lifecycle is a per-item state machine following the arc
 * 建立 → 变化 → 运行 → 回收. Each stage can define a trigger condition, the
 * state change it causes, and the character holding the object at that stage.
 */

/**
 * @typedef {Object} LifecycleStage
 * @property {string} id
 * @property {string} label       — stage / state name, e.g. "建立"
 * @property {string} description — what happens at this stage
 * @property {string} trigger     — condition that advances into this stage
 * @property {string} change      — the state change this stage causes
 * @property {string} holder      — character holding the object at this stage
 */

/**
 * @typedef {Object} ObjectLifecycle
 * @property {string}  id
 * @property {string}  worldId
 * @property {string}  title       — short label, e.g. "O-01"
 * @property {string}  itemId      — bound physical item, "" if none
 * @property {string}  itemLabel   — persistent display name for the item
 * @property {string}  summary     — overview of the lifecycle
 * @property {LifecycleStage[]} stages — ordered state chain
 * @property {string}  createdAt
 * @property {string}  updatedAt
 */

export const OBJECT_LIFECYCLE_EDITOR_VERSION = 1;

export const OBJECT_LIFECYCLE_API_PREFIX = "/api/worlds/:worldId/object-lifecycles";

/** Default empty draft for a new object lifecycle */
export function emptyObjectLifecycleDraft() {
  return {
    title: "",
    itemId: "",
    itemLabel: "",
    summary: "",
    stages: []
  };
}

/** Create an empty lifecycle stage. */
export function createLifecycleStage(label = "", description = "", trigger = "", change = "", holder = "") {
  return {
    id: "",
    label,
    description,
    trigger,
    change,
    holder
  };
}

/** Build an object lifecycle for client-side use. */
export function buildObjectLifecycle(overrides = {}) {
  return {
    id: overrides.id || "",
    worldId: overrides.worldId || "",
    title: overrides.title || "",
    itemId: overrides.itemId || "",
    itemLabel: overrides.itemLabel || "",
    summary: overrides.summary || "",
    stages: overrides.stages || [],
    createdAt: overrides.createdAt || "",
    updatedAt: overrides.updatedAt || ""
  };
}