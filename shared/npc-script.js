/**
 * NPC Script Editor — shared types.
 *
 * NPC 专属内容：把非玩家角色的独立剧本、身份人生、以及一组"显著数值"
 * （如酒力固定 5）集中登记，供后续按槽位引用。salient_nums 为数值键值对。
 */

/**
 * @typedef {Object} NpcRecord
 * @property {string} id
 * @property {string} worldId
 * @property {string} title        — short label + slot name, e.g. "NPC-01 柳诗诗"
 * @property {number} sequence     — ordering in the NPC list
 * @property {Object} salientNums  — 显著数值键值对, e.g. { 酒力: 5, 牌资: 3 }
 * @property {string} summary      — 一句话定位
 * @property {string} bio          — 身份人生
 * @property {string} privateScript — 独立 NPC 剧本
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export const NPC_EDITOR_VERSION = 1;

export const NPC_API_PREFIX = "/api/worlds/:worldId/npcs";

/** Default empty draft for a new NPC record. */
export function emptyNpcDraft() {
  return {
    title: "",
    sequence: 0,
    salientNums: {},
    summary: "",
    bio: "",
    privateScript: ""
  };
}

/** Build an NPC record for client-side use. */
export function buildNpcRecord(overrides = {}) {
  return {
    id: overrides.id || "",
    worldId: overrides.worldId || "",
    title: overrides.title || "",
    sequence: overrides.sequence || 0,
    salientNums: overrides.salientNums || {},
    summary: overrides.summary || "",
    bio: overrides.bio || "",
    privateScript: overrides.privateScript || "",
    createdAt: overrides.createdAt || "",
    updatedAt: overrides.updatedAt || ""
  };
}

/** Parse a salient-number row pair into the map. */
export function salientNumsToEntries(map = {}) {
  return Object.entries(map || {}).map(([key, value]) => ({ key, value }));
}

/** Rebuild the salientNums map from entry rows. */
export function entriesToSalientNums(entries = []) {
  const out = {};
  (entries || []).forEach((row) => {
    out[row.key] = Number(row.value) || 0;
  });
  return out;
}