/**
 * Historical Causality Table — shared types.
 *
 * Covers 《长生叹》H-01~H-26: 26 historical events across 500 years arranged as
 * a causal chain. Each event is one link: cause_text (前因) → event_text (事件)
 * → effect_text (后果), ordered by sequence + when_text (年代).
 */

/**
 * @typedef {Object} HistoryCausalLink
 * @property {string}  id
 * @property {string}  worldId
 * @property {string}  title        — short label, e.g. "H-01"
 * @property {number}  sequence     — causal chain order (年代先后)
 * @property {string}  whenText     — 年代/纪年, e.g. "前 480 年"
 * @property {string}  actors       — 角色/势力标签 (逗号分隔)
 * @property {string}  causeText    — 前因：什么导致了这个事件
 * @property {string}  eventText    — 事件本身：发生了什么
 * @property {string}  effectText   — 后果：改变了什么，引出哪个后续事件
 * @property {string}  summary      — 该事件在整条因果链中的作用概述
 * @property {string}  createdAt
 * @property {string}  updatedAt
 */

export const HISTORY_CAUSAL_EDITOR_VERSION = 1;

export const HISTORY_CAUSAL_API_PREFIX = "/api/worlds/:worldId/history-causal-links";

/** Default empty draft for a new historical causal link */
export function emptyHistoryCausalDraft() {
  return {
    title: "",
    sequence: 1,
    whenText: "",
    actors: "",
    causeText: "",
    eventText: "",
    effectText: "",
    summary: ""
  };
}

/** Build a history causal link for client-side use. */
export function buildHistoryCausal(overrides = {}) {
  return {
    id: overrides.id || "",
    worldId: overrides.worldId || "",
    title: overrides.title || "",
    sequence: Number(overrides.sequence) || 1,
    whenText: overrides.whenText || "",
    actors: overrides.actors || "",
    causeText: overrides.causeText || "",
    eventText: overrides.eventText || "",
    effectText: overrides.effectText || "",
    summary: overrides.summary || "",
    createdAt: overrides.createdAt || "",
    updatedAt: overrides.updatedAt || ""
  };
}