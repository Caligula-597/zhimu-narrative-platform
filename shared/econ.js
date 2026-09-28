/**
 * Economic System Editor — shared types.
 *
 * Covers 《青楼》银两初始资源(CFG-05)、拍卖、宝箱、经济规则闭环.
 * A record is one economic statement/fact in the world, grouped by category.
 *
 * ── 机制生成流线 预留接口 ─────────────────────────────
 * ECON 上游是创作者经济设定；本模块的下游是"机制生成流线"——
 * 生成流线就绪后，会把经济记录折叠成主持端可操控、玩家端可操控的小游戏
 * 系统（如 auction_exchange 母型、currency_ledger 记分、CURRENCY_RESOURCE_KEY）。
 * 因生成流线暂未建成，这里只暴露契约 `econToMechanismPipeline` 与
 * `ECON_MECHANISM_BRIDGE_RESERVED` 状态，接口保持惰性可调用，不接入真实链路。
 */

/**
 * @typedef {Object} EconRecord
 * @property {string} id
 * @property {string} worldId
 * @property {string} title        — short label, e.g. "ECON-01"
 * @property {string} category     — initial / auction / treasure / rule
 * @property {number} sequence     — ordering within category
 * @property {string} actorLabel   — 涉及角色/势力标签
 * @property {number} amount       — 数值（银两/物品量），可为 0
 * @property {string} source       — 来源（章节 / 条目编号 / 备注出处）
 * @property {string} note         — 说明 / 结算规则
 * @property {string} summary      — 在经济闭环中的作用概述
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export const ECON_EDITOR_VERSION = 1;

export const ECON_API_PREFIX = "/api/worlds/:worldId/econ-records";

/** Categories for economic records. */
export const ECON_CATEGORIES = [
  { key: "initial", label: "银两初始资源" },
  { key: "auction", label: "拍卖" },
  { key: "treasure", label: "宝箱" },
  { key: "rule", label: "经济规则" }
];

export const ECON_CATEGORY_LABELS = ECON_CATEGORIES.reduce((acc, c) => {
  acc[c.key] = c.label;
  return acc;
}, {});

/** Default empty draft for a new economic record. */
export function emptyEconDraft() {
  return {
    title: "",
    category: "initial",
    sequence: 0,
    actorLabel: "",
    amount: 0,
    source: "",
    note: "",
    summary: ""
  };
}

/** Build an economic record for client-side use. */
export function buildEconRecord(overrides = {}) {
  return {
    id: overrides.id || "",
    worldId: overrides.worldId || "",
    title: overrides.title || "",
    category: overrides.category || "initial",
    sequence: overrides.sequence || 0,
    actorLabel: overrides.actorLabel || "",
    amount: overrides.amount || 0,
    source: overrides.source || "",
    note: overrides.note || "",
    summary: overrides.summary || "",
    createdAt: overrides.createdAt || "",
    updatedAt: overrides.updatedAt || ""
  };
}

/**
 * ── 机制生成流线 · 预留接口 ──
 *
 * 生成流线就绪前：返回 `{ reserved: true, ready:false, payload: null }`，
 * 调用方不应把结果当作已生成机制使用。
 * 生成流线就绪后：此处将把经济记录折叠成机制管线输入，接入主持端/玩家端
 * 可操控的小游戏系统。当前仅保证"数据可被未来管线消费"的契约不变。
 *
 * @param {EconRecord[]} records 当前世界的经济记录
 * @returns {{reserved:boolean, ready:boolean, payload:(object|null)}}
 */
export function econToMechanismPipeline(records = []) {
  const auction = (records || []).filter((r) => r.category === "auction");
  const treasure = (records || []).filter((r) => r.category === "treasure");
  const initial = (records || []).filter((r) => r.category === "initial");
  const rules = (records || []).filter((r) => r.category === "rule");
  return {
    reserved: true,
    ready: false,
    payload: {
      auctionCount: auction.length,
      treasureCount: treasure.length,
      initialCount: initial.length,
      ruleCount: rules.length
    }
  };
}

/** Marker: the economic→mechanism bridge is reserved but not yet wired. */
export const ECON_MECHANISM_BRIDGE_RESERVED = true;

/** Reserved-ish mapping: econ category → likely mechanism kit direction (no-op for now). */
export const ECON_TO_MECHANISM_KIT_HINT = Object.freeze({
  auction: "auction_exchange",
  rule: "resource_allocation"
});