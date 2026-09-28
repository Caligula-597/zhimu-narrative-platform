/**
 * Location / Scene-State Enhancement — shared types.
 *
 * LOC 属"增强"性质：登记地点/开放地图/现场状态，覆盖衙门令搜证、现场改写
 * （已搜证/被改写）、监狱即时杀人点。属"空间访问"与"证据资格"方向的创作者
 * 设定输入，前端编辑器登记即可满足需求。
 */

/**
 * @typedef {Object} LocRecord
 * @property {string} id
 * @property {string} worldId
 * @property {string} title        — short label, e.g. "LOC-01 城西青树"
 * @property {number} sequence
 * @property {string} kind         — 衙门 / 监狱 / 开放地图 / 现场
 * @property {boolean} searchable  — 是否可搜证
 * @property {boolean} rewritable  — 现场是否可被改写
 * @property {Object} state        — 现场状态 JSONB（已搜证/被改写/尸体数…）
 * @property {boolean} combat      — 是否为监狱即时杀人点
 * @property {string} itemsNote    — 物品/陈列说明
 * @property {string} note         — 备注
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export const LOC_EDITOR_VERSION = 1;

export const LOC_API_PREFIX = "/api/worlds/:worldId/loc-locations";

/** Kinds of location record. */
export const LOC_KINDS = ["衙门", "监狱", "开放地图", "现场"];

/** Default empty draft for a new location record. */
export function emptyLocDraft() {
  return {
    title: "",
    sequence: 0,
    kind: "现场",
    searchable: true,
    rewritable: false,
    state: {},
    combat: false,
    itemsNote: "",
    note: ""
  };
}

/** Build a location record for client-side use. */
export function buildLocRecord(overrides = {}) {
  return {
    id: overrides.id || "",
    worldId: overrides.worldId || "",
    title: overrides.title || "",
    sequence: overrides.sequence || 0,
    kind: overrides.kind || "现场",
    searchable: overrides.searchable ?? true,
    rewritable: overrides.rewritable ?? false,
    state: overrides.state || {},
    combat: overrides.combat ?? false,
    itemsNote: overrides.itemsNote || "",
    note: overrides.note || "",
    createdAt: overrides.createdAt || "",
    updatedAt: overrides.updatedAt || ""
  };
}