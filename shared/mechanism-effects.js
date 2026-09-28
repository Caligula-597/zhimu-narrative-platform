/**
 * 原子效果库（机制引擎）
 *
 * 这是机制成品设计库 V2.0 第三部分「原子效果库」的确定性实现。
 * 目标是：任何机制模板中的规则变更，都必须落到这里的一个效果码，而不是由
 * AI 或主持人在现场"发明效果"。设计库原文约束：
 *   "任何新效果必须先进入效果库、定义参数与冲突次序、通过单元测试，才能进入模板。"
 *
 * 设计原则：
 * 1. 纯函数、确定性：applyEffect 不修改入参，返回新状态 + 一条 change 日志。
 * 2. 随机只来自可注入的 rng（DRAW / REROLL 用），测试时用固定序列保证可复现。
 * 3. 每个效果码都在 MECHANISM_EFFECT_CATALOG 里声明：功能、参数含义、冲突处理，
 *    以便作者与主机都读得懂，也方便"复用"时只改参数不改语义。
 *
 * 关于"填入位置含义"：每个效果的 params 字段都逐个说明了关键名代表什么，
 * 见 MECHANISM_EFFECT_CATALOG。
 */

const INT = (description) => ({ type: "integer", description });
const NUM = (description) => ({ type: "number", description });
const STR = (description) => ({ type: "string", description });
const BOOL = (description) => ({ type: "boolean", description });
const LIST = (description) => ({ type: "list", description });
const ANY = (description) => ({ type: "any", description });

export class MechanismEffectError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "MechanismEffectError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function fail(code, message, details) {
  throw new MechanismEffectError(code, message, details);
}

const clone = (value) => {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
};

function playerIndex(state, playerId) {
  const id = String(playerId ?? "");
  if (!state.players[id]) fail("EFFECT_TARGET_UNKNOWN", `Unknown player ${id}`, { playerId: id });
  return id;
}

function int(value, key, fallback = 0) {
  const n = Number(value);
  if (value !== undefined && !Number.isFinite(n))
    fail("EFFECT_INVALID_PARAMS", `${key} must be numeric`, { key, value });
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function touchPlayer(state, playerId, updater) {
  const id = playerIndex(state, playerId);
  const players = {
    ...state.players,
    [id]: updater({ ...state.players[id] }),
  };
  return { ...state, players };
}

function pushChange(changes, change) {
  changes.push(change);
}

/**
 * 创建一个状态可扩展的 arena：players 至少有空表，容量、牌堆、内容登记等都有默认空值。
 * 模板实例化时把作品专用配置从这里注入（参与人数、资源容量、牌堆、预置内容、rng）。
 */
export function createGameState(config = {}) {
  const state = {
    schemaVersion: 1,
    // 玩家状态
    players: {},
    // 资源容量模板：resourceKey -> 最大持有值；null = 无上限
    capacity: { ...(config.capacity || {}) },
    maxShield: config.maxShield ?? null,
    maxDurability: config.maxDurability ?? 10,
    phaseActionCap: config.phaseActionCap ?? 3,
    allowHealAtZero: config.allowHealAtZero ?? true,
    // 服务器牌堆：pileKey -> [cardId, ...]
    decks: { ...(config.decks || {}) },
    deckDrawRule: config.deckDrawRule ?? "shuffle", // shuffle | stop
    // 预置内容登记：REVEAL 只能揭示这里已存在的内容
    content: { ...(config.content || {}) },
    // 揭示状态
    revealedPublic: {},
    revealedPrivate: {}, // playerId -> { contentId: true }
    // 状态效果：锁定 / 禁入 / 免疫
    locks: {}, // scope("*" 或 playerId) -> { actionKey: true }
    silences: {},
    // 出价与结算码
    bids: {}, // bidId -> { playerId, amount, assetKey, status }
    verdicts: {}, // verdictId -> true（COUNTER 不能反制结算码）
    // 区域控制：areaKey -> { playerId: number }
    areas: {},
    // 轮次
    turnOrder: Array.isArray(config.players) ? config.players.map(String) : [],
    currentTurn: config.currentTurn ?? null,
    // 随机源与日志
    rng: typeof config.rng === "function" ? config.rng : Math.random,
    rngResults: {}, // scope -> 最近一次随机值
    log: [],
  };
  for (const id of state.turnOrder) {
    state.players[id] = newPlayerState(config, id);
  }
  if (state.currentTurn && !state.players[state.currentTurn]) {
    fail("EFFECT_TARGET_UNKNOWN", `currentTurn ${state.currentTurn} is not a known player`, {
      playerId: state.currentTurn,
    });
  }
  return state;
}

function newPlayerState(config, id) {
  return {
    durability: config.maxDurability ?? 10,
    maxDurability: config.maxDurability ?? 10,
    score: 0,
    shield: 0,
    shieldDuration: 0,
    held: [],
    actionsRemaining: 1,
    resources: {},
    areaControl: {},
    immunities: {}, // effectCode -> turnsLeft
  };
}

/**
 * 效果注册表。apply(state, params, ctx) -> { state, change }
 * - state: 新状态
 * - change: 追加进 state.log 的一条结构化变更
 * ctx 提供 source（来源键）、settlementWindow（是否在结算窗口内）等上下文。
 */
export const MECHANISM_EFFECT_CATALOG = Object.freeze({
  DAMAGE: Object.freeze({
    code: "DAMAGE",
    copyable: true,
    description: "减少目标生命/耐久；先扣护盾，剩余部分再扣耐久。",
    params: {
      amount: INT("伤害数值"),
      target: STR("受击玩家ID"),
    },
    apply(state, p, ctx) {
      const id = playerIndex(state, p.target);
      const amount = Math.max(0, int(p.amount, "amount"));
      let { shield, durability } = state.players[id];
      const absorbed = Math.min(shield, amount);
      shield -= absorbed;
      const remainder = Math.max(0, amount - absorbed);
      const beforeDurability = durability;
      durability = Math.max(0, durability - remainder);
      const after = touchPlayer(state, id, (pl) => ({ ...pl, shield, durability }));
      return {
        state: after,
        change: {
          code: "DAMAGE",
          target: id,
          amount,
          absorbed,
          beforeDurability,
          afterDurability: durability,
          shield,
          sourceKey: ctx.source,
        },
      };
    },
  }),

  HEAL: Object.freeze({
    code: "HEAL",
    copyable: true,
    description: "恢复生命但不超过上限；生命归零后能否恢复由模板 allowHealAtZero 锁定。",
    params: {
      amount: NUM("恢复数值"),
      target: STR("恢复对象玩家ID"),
    },
    apply(state, p, ctx) {
      const id = playerIndex(state, p.target);
      const amount = int(p.amount, "amount");
      const pl = state.players[id];
      if (pl.durability <= 0 && state.allowHealAtZero === false) {
        fail("EFFECT_GATING", "Healing at zero durability is locked by template", {
          target: id,
        });
      }
      const before = pl.durability;
      const afterValue = Math.min(pl.maxDurability, before + amount);
      const after = touchPlayer(state, id, (current) => ({
        ...current,
        durability: afterValue,
      }));
      return {
        state: after,
        change: {
          code: "HEAL",
          target: id,
          amount,
          before,
          after: afterValue,
          sourceKey: ctx.source,
        },
      };
    },
  }),

  SHIELD: Object.freeze({
    code: "SHIELD",
    copyable: true,
    description: "抵消防后续损失；同类护盾默认相加，上限由模板 maxShield 设定。",
    params: {
      amount: NUM("护盾数值"),
      target: STR("获得护盾的玩家ID"),
      duration: INT("护盾持续轮数（0 表示仅本结算窗口）"),
    },
    apply(state, p, ctx) {
      const id = playerIndex(state, p.target);
      const amount = int(p.amount, "amount");
      const pl = state.players[id];
      const before = pl.shield;
      let next = before + amount;
      if (Number.isFinite(Number(state.maxShield))) {
        next = Math.min(Number(state.maxShield), next);
      }
      const after = touchPlayer(state, id, (current) => ({
        ...current,
        shield: next,
        shieldDuration: int(p.duration, "duration"),
      }));
      return {
        state: after,
        change: { code: "SHIELD", target: id, amount, before, after: next, sourceKey: ctx.source },
      };
    },
  }),

  DRAW: Object.freeze({
    code: "DRAW",
    copyable: true,
    description: "从服务器牌堆取得内容到玩家手中。牌堆不足时按 deckDrawRule 洗回或停止。",
    params: {
      target: STR("抽牌玩家ID"),
      pileKey: STR("牌堆键（decks 的 key）"),
      count: INT("抽取数量"),
      visibility: STR("public | private，默认 private"),
    },
    apply(state, p, ctx) {
      const id = playerIndex(state, p.target);
      const count = Math.max(0, int(p.count, "count"));
      const pile = state.decks[p.pileKey] ? [...state.decks[p.pileKey]] : [];
      const available = Math.min(count, pile.length);
      if (available < count && state.deckDrawRule === "stop") {
        fail("EFFECT_INSUFFICIENT", "Deck does not have enough cards", {
          pileKey: p.pileKey,
          requested: count,
          available,
        });
      }
      const drawn = pile.splice(0, available);
      const visibility = p.visibility === "public" ? "public" : "private";
      let after = touchPlayer(state, id, (current) => ({
        ...current,
        held: [...current.held, ...drawn],
      }));
      after = { ...after, decks: { ...after.decks, [p.pileKey]: pile } };
      if (visibility === "public") {
        const reveals = { ...after.revealedPublic };
        for (const card of drawn) reveals[String(card)] = true;
        after = { ...after, revealedPublic: reveals };
      }
      return {
        state: after,
        change: {
          code: "DRAW",
          target: id,
          pileKey: p.pileKey,
          count: available,
          drawn,
          visibility,
          sourceKey: ctx.source,
        },
      };
    },
  }),

  DISCARD: Object.freeze({
    code: "DISCARD",
    copyable: true,
    description: "移除玩家所持组件；不足时整次失败，不做部分移除。",
    params: {
      target: STR("弃牌玩家ID"),
      count: INT("移除数量"),
      selector: STR("可选：要移除的组件的完全匹配键；缺省时从手牌头部移除"),
    },
    apply(state, p, ctx) {
      const id = playerIndex(state, p.target);
      const count = Math.max(0, int(p.count, "count"));
      const held = [...state.players[id].held];
      let indices = [];
      if (p.selector !== undefined && p.selector !== null && p.selector !== "") {
        for (let i = 0; i < held.length; i += 1) {
          if (String(held[i]) === String(p.selector)) indices.push(i);
        }
      } else {
        indices = held.map((_, i) => i);
      }
      if (indices.length < count) {
        fail("EFFECT_INSUFFICIENT", "Insufficient matching components to discard", {
          target: id,
          requested: count,
          available: indices.length,
        });
      }
      const toRemove = new Set(indices.slice(0, count));
      const removed = [];
      const remaining = [];
      held.forEach((card, i) => {
        if (toRemove.has(i)) removed.push(card);
        else remaining.push(card);
      });
      const after = touchPlayer(state, id, (current) => ({ ...current, held: remaining }));
      return {
        state: after,
        change: { code: "DISCARD", target: id, removed, count, sourceKey: ctx.source },
      };
    },
  }),

  STEAL: Object.freeze({
    code: "STEAL",
    copyable: true,
    description: "把规则资源从一方转给另一方；只触碰规则资源，不触碰普通信息。",
    params: {
      from: STR("被转移的玩家ID"),
      to: STR("接收的玩家ID"),
      resource: STR("资源键"),
      amount: INT("转移数量"),
    },
    apply(state, p, ctx) {
      const fromId = playerIndex(state, p.from);
      const toId = playerIndex(state, p.to);
      const amount = Math.max(0, int(p.amount, "amount"));
      const fromHold = Number(state.players[fromId].resources[p.resource] || 0);
      if (fromHold < amount) {
        fail("EFFECT_INSUFFICIENT", "Not enough resource to steal", {
          from: fromId,
          resource: p.resource,
          held: fromHold,
          amount,
        });
      }
      const cap = Number(state.capacity[p.resource]);
      const capLimit = Number.isFinite(cap) ? cap : null;
      const toHold = Number(state.players[toId].resources[p.resource] || 0);
      let gain = amount;
      if (capLimit !== null) gain = Math.min(gain, capLimit - toHold);
      let after = touchPlayer(state, fromId, (current) => ({
        ...current,
        resources: { ...current.resources, [p.resource]: fromHold - amount },
      }));
      after = touchPlayer(after, toId, (current) => ({
        ...current,
        resources: { ...current.resources, [p.resource]: toHold + gain },
      }));
      return {
        state: after,
        change: {
          code: "STEAL",
          from: fromId,
          to: toId,
          resource: p.resource,
          amount,
          gained: gain,
          sourceKey: ctx.source,
        },
      };
    },
  }),

  SWAP: Object.freeze({
    code: "SWAP",
    copyable: true,
    description: "两个正式状态互换；必须原子执行（要么整体成功，要么整体失败）。",
    params: {
      field_a: ANY("{ player, field } 第一个交换位置"),
      field_b: ANY("第二个交换位置 { player, field }"),
    },
    apply(state, p, ctx) {
      const a = p.field_a || {};
      const b = p.field_b || {};
      const aId = playerIndex(state, a.player);
      const bId = playerIndex(state, b.player);
      if (typeof a.field !== "string" || typeof b.field !== "string" || !a.field || !b.field) {
        fail("EFFECT_INVALID_PARAMS", "SWAP requires field_a.field and field_b.field", {
          a,
          b,
        });
      }
      const aVal = state.players[aId][a.field];
      const bVal = state.players[bId][b.field];
      let after = touchPlayer(state, aId, (current) => ({ ...current, [a.field]: bVal }));
      after = touchPlayer(after, bId, (current) => ({ ...current, [b.field]: aVal }));
      return {
        state: after,
        change: {
          code: "SWAP",
          a: { player: aId, field: a.field },
          b: { player: bId, field: b.field },
          sourceKey: ctx.source,
        },
      };
    },
  }),

  COPY: Object.freeze({
    code: "COPY",
    copyable: false,
    description:
      "把一次可复制效果复制到目标上执行；不复制唯一奖励、出价或身份状态（对应效果 copyable=false）。",
    params: {
      source: ANY("可复制效果描述 { code, ...params }"),
      target: STR("复制效果的作用目标"),
    },
    apply(state, p, ctx) {
      const src = p.source || {};
      const entry = MECHANISM_EFFECT_CATALOG[src.code];
      if (!entry) fail("EFFECT_INVALID_PARAMS", "COPY source effect code is unknown", { source: src });
      if (entry.copyable === false) {
        fail("EFFECT_NOT_COPYABLE", `Effect ${src.code} cannot be copied`, { code: src.code });
      }
      return entry.apply(state, { ...src, target: p.target }, { ...ctx, via: "COPY" });
    },
  }),

  LOCK: Object.freeze({
    code: "LOCK",
    copyable: true,
    description: "暂停某项合法操作；不得锁死玩家全部正式操作。",
    params: {
      action: STR("要暂停的正式操作键"),
      target: STR("作用玩家ID，或 '*' 表示全体"),
      duration: INT("持续轮数"),
    },
    apply(state, p, ctx) {
      if (String(p.action) === "*") {
        fail("EFFECT_LOCK_ALL_REJECTED", "LOCK cannot target all actions at once", { action: p.action });
      }
      const scope = String(p.target ?? "*");
      const after = {
        ...state,
        locks: { ...state.locks, [scope]: { ...(state.locks[scope] || {}), [p.action]: true } },
      };
      return {
        state: after,
        change: { code: "LOCK", action: p.action, scope, duration: int(p.duration, "duration"), sourceKey: ctx.source },
      };
    },
  }),

  SILENCE: Object.freeze({
    code: "SILENCE",
    copyable: true,
    description: "禁止正式提交某类动作；不影响现实语音发言。",
    params: {
      action: STR("要禁止提交的动作类别"),
      target: STR("作用玩家ID，或 '*' 表示全体"),
      duration: INT("持续轮数"),
    },
    apply(state, p, ctx) {
      if (String(p.action) === "*") {
        fail("EFFECT_SILENCE_ALL_REJECTED", "SILENCE cannot target all actions at once", {
          action: p.action,
        });
      }
      const scope = String(p.target ?? "*");
      const after = {
        ...state,
        silences: {
          ...state.silences,
          [scope]: { ...(state.silences[scope] || {}), [p.action]: true },
        },
      };
      return {
        state: after,
        change: {
          code: "SILENCE",
          action: p.action,
          scope,
          duration: int(p.duration, "duration"),
          sourceKey: ctx.source,
        },
      };
    },
  }),

  SKIP_TURN: Object.freeze({
    code: "SKIP_TURN",
    copyable: true,
    description: "本轮对目标采用模板默认行动；不让玩家永久离场。",
    params: {
      target: STR("被跳过的玩家ID"),
    },
    apply(state, p, ctx) {
      const id = playerIndex(state, p.target);
      const after = touchPlayer(state, id, (current) => ({
        ...current,
        actionsRemaining: 0,
      }));
      return {
        state: after,
        change: { code: "SKIP_TURN", target: id, sourceKey: ctx.source },
      };
    },
  }),

  EXTRA_ACTION: Object.freeze({
    code: "EXTRA_ACTION",
    copyable: true,
    description: "增加一次正式行动；不能跨越阶段行动上限 phaseActionCap。",
    params: {
      target: STR("获得额外行动的玩家ID"),
      count: INT("增加的次数"),
      action_scope: STR("可选：限定的行动类别"),
    },
    apply(state, p, ctx) {
      const id = playerIndex(state, p.target);
      const count = Math.max(0, int(p.count, "count"));
      const before = state.players[id].actionsRemaining;
      const capNow = Math.trunc(Number(state.phaseActionCap) || 0);
      const afterVal = Math.min(capNow, before + count);
      const after = touchPlayer(state, id, (current) => ({
        ...current,
        actionsRemaining: afterVal,
      }));
      return {
        state: after,
        change: {
          code: "EXTRA_ACTION",
          target: id,
          count,
          before,
          after: afterVal,
          actionScope: p.action_scope,
          sourceKey: ctx.source,
        },
      };
    },
  }),

  RESOURCE_GAIN: Object.freeze({
    code: "RESOURCE_GAIN",
    copyable: true,
    description: "增加规则资源；受容量上限 capacity 限制。",
    params: {
      target: STR("获得资源的玩家ID"),
      resource: STR("资源键"),
      amount: INT("增加数量"),
    },
    apply(state, p, ctx) {
      const id = playerIndex(state, p.target);
      const amount = Math.max(0, int(p.amount, "amount"));
      const before = Number(state.players[id].resources[p.resource] || 0);
      const cap = Number(state.capacity[p.resource]);
      const capLimit = Number.isFinite(cap) ? cap : null;
      let afterVal = before + amount;
      if (capLimit !== null) afterVal = Math.min(capLimit, afterVal);
      const after = touchPlayer(state, id, (current) => ({
        ...current,
        resources: { ...current.resources, [p.resource]: afterVal },
      }));
      return {
        state: after,
        change: {
          code: "RESOURCE_GAIN",
          target: id,
          resource: p.resource,
          amount,
          before,
          after: afterVal,
          sourceKey: ctx.source,
        },
      };
    },
  }),

  RESOURCE_LOSS: Object.freeze({
    code: "RESOURCE_LOSS",
    copyable: true,
    description: "扣除规则资源；不产生负数（扣到 0 为止）。",
    params: {
      target: STR("失去资源的玩家ID"),
      resource: STR("资源键"),
      amount: INT("扣除数量"),
    },
    apply(state, p, ctx) {
      const id = playerIndex(state, p.target);
      const amount = Math.max(0, int(p.amount, "amount"));
      const before = Number(state.players[id].resources[p.resource] || 0);
      const afterVal = Math.max(0, before - amount);
      const after = touchPlayer(state, id, (current) => ({
        ...current,
        resources: { ...current.resources, [p.resource]: afterVal },
      }));
      return {
        state: after,
        change: {
          code: "RESOURCE_LOSS",
          target: id,
          resource: p.resource,
          amount,
          before,
          after: afterVal,
          blocked: before - afterVal < amount,
          sourceKey: ctx.source,
        },
      };
    },
  }),

  REVEAL_PUBLIC: Object.freeze({
    code: "REVEAL_PUBLIC",
    copyable: true,
    description: "向全体开放既有内容；内容必须预先存在。",
    params: {
      content_id: STR("要公开的内容ID"),
    },
    apply(state, p, ctx) {
      if (!state.content[p.content_id]) {
        fail("EFFECT_CONTENT_MISSING", "REVEAL_PUBLIC references missing content", {
          contentId: p.content_id,
        });
      }
      const after = {
        ...state,
        revealedPublic: { ...state.revealedPublic, [p.content_id]: true },
      };
      return {
        state: after,
        change: { code: "REVEAL_PUBLIC", contentId: p.content_id, sourceKey: ctx.source },
      };
    },
  }),

  REVEAL_PRIVATE: Object.freeze({
    code: "REVEAL_PRIVATE",
    copyable: true,
    description: "向指定玩家开放既有内容；接收者自行决定是否公开。",
    params: {
      content_id: STR("要私下开放的内容ID"),
      target: STR("接收玩家ID"),
    },
    apply(state, p, ctx) {
      if (!state.content[p.content_id]) {
        fail("EFFECT_CONTENT_MISSING", "REVEAL_PRIVATE references missing content", {
          contentId: p.content_id,
        });
      }
      const id = playerIndex(state, p.target);
      const privateMap = { ...(state.revealedPrivate[id] || {}) };
      privateMap[p.content_id] = true;
      const after = { ...state, revealedPrivate: { ...state.revealedPrivate, [id]: privateMap } };
      return {
        state: after,
        change: { code: "REVEAL_PRIVATE", contentId: p.content_id, target: id, sourceKey: ctx.source },
      };
    },
  }),

  REROLL: Object.freeze({
    code: "REROLL",
    copyable: true,
    description: "重投一次随机结果；新结果覆盖旧结果并保留日志。",
    params: {
      scope: STR("随机结果的作用域键（用于定位覆盖哪个结果）"),
    },
    apply(state, p, ctx) {
      const before = state.rngResults[p.scope];
      const afterVal = state.rng();
      return {
        state: {
          ...state,
          rngResults: { ...state.rngResults, [p.scope]: afterVal },
        },
        change: { code: "REROLL", scope: p.scope, before, after: afterVal, sourceKey: ctx.source },
      };
    },
  }),

  REDIRECT: Object.freeze({
    code: "REDIRECT",
    copyable: true,
    description: "改变一个动作的目标；只能在结算窗口内使用。",
    params: {
      source: STR("原目标玩家ID"),
      new_target: STR("新目标玩家ID"),
    },
    apply(state, p, ctx) {
      if (ctx.settlementWindow !== true) {
        fail("EFFECT_WINDOW_CLOSED", "REDIRECT may only be used inside the settlement window", {
          source: p.source,
        });
      }
      const after = {
        ...state,
        redirects: { ...(state.redirects || {}), [p.source]: p.new_target },
      };
      return {
        state: after,
        change: { code: "REDIRECT", source: p.source, newTarget: p.new_target, sourceKey: ctx.source },
      };
    },
  }),

  COUNTER: Object.freeze({
    code: "COUNTER",
    copyable: false,
    description: "取消一个允许被反制的效果；不能反制结算码（verdicts）。",
    params: {
      effect_id: STR("要反制的效果实例ID"),
    },
    apply(state, p, ctx) {
      if (state.verdicts[p.effect_id]) {
        fail("EFFECT_NOT_COUNTERABLE", "COUNTER cannot target a settlement code", {
          effectId: p.effect_id,
        });
      }
      const after = {
        ...state,
        countered: { ...(state.countered || {}), [p.effect_id]: true },
      };
      return {
        state: after,
        change: { code: "COUNTER", effectId: p.effect_id, sourceKey: ctx.source },
      };
    },
  }),

  IMMUNITY: Object.freeze({
    code: "IMMUNITY",
    copyable: true,
    description: "在期限内免疫指定效果；不允许全效果永久免疫。",
    params: {
      target: STR("获得免疫的玩家ID"),
      effect_scope: STR("被免疫的效果码（'*' 表示全部）"),
      duration: INT("持续轮数"),
    },
    apply(state, p, ctx) {
      const id = playerIndex(state, p.target);
      if (String(p.effect_scope) === "*" && Number(p.duration) === Infinity) {
        fail("EFFECT_IMMUNITY_REJECTED", "Permanent immunity to all effects is not allowed", {
          target: id,
        });
      }
      const after = touchPlayer(state, id, (current) => ({
        ...current,
        immunities: { ...current.immunities, [p.effect_scope]: int(p.duration, "duration") },
      }));
      return {
        state: after,
        change: {
          code: "IMMUNITY",
          target: id,
          effectScope: p.effect_scope,
          duration: int(p.duration, "duration"),
          sourceKey: ctx.source,
        },
      };
    },
  }),

  AREA_CONTROL: Object.freeze({
    code: "AREA_CONTROL",
    copyable: true,
    description: "增减某区域的控制值；多人同时提交后由模板统一结算。",
    params: {
      target: STR("玩家ID"),
      area: STR("区域键"),
      amount: INT("增减值（可为负）"),
    },
    apply(state, p, ctx) {
      const id = playerIndex(state, p.target);
      const amount = int(p.amount, "amount");
      const area = String(p.area ?? "");
      const before = Number(state.players[id].areaControl[area] || 0);
      const afterVal = before + amount;
      const after = touchPlayer(state, id, (current) => ({
        ...current,
        areaControl: { ...current.areaControl, [area]: afterVal },
      }));
      return {
        state: after,
        change: { code: "AREA_CONTROL", target: id, area, amount, before, after: afterVal, sourceKey: ctx.source },
      };
    },
  }),

  SCORE_GAIN: Object.freeze({
    code: "SCORE_GAIN",
    copyable: true,
    description: "增加正式积分；记录来源。",
    params: {
      target: STR("玩家ID"),
      amount: INT("增加积分"),
    },
    apply(state, p, ctx) {
      const id = playerIndex(state, p.target);
      const amount = int(p.amount, "amount");
      const before = state.players[id].score;
      const afterVal = before + amount;
      const after = touchPlayer(state, id, (current) => ({ ...current, score: afterVal }));
      return {
        state: after,
        change: { code: "SCORE_GAIN", target: id, amount, before, after: afterVal, sourceKey: ctx.source },
      };
    },
  }),

  SCORE_MULTIPLY: Object.freeze({
    code: "SCORE_MULTIPLY",
    copyable: true,
    description: "将某类得分乘上一个系数；默认在加算（SCORE_GAIN）之后执行。",
    params: {
      target: STR("玩家ID"),
      factor: NUM("乘算系数"),
      scope: STR("可选：限定得分类别"),
    },
    apply(state, p, ctx) {
      const id = playerIndex(state, p.target);
      const factor = Number(p.factor);
      if (!Number.isFinite(factor)) fail("EFFECT_INVALID_PARAMS", "SCORE_MULTIPLY factor must be numeric", { factor: p.factor });
      const before = state.players[id].score;
      const afterVal = before * factor;
      const after = touchPlayer(state, id, (current) => ({ ...current, score: afterVal }));
      return {
        state: after,
        change: {
          code: "SCORE_MULTIPLY",
          target: id,
          factor,
          scope: p.scope,
          before,
          after: afterVal,
          sourceKey: ctx.source,
        },
      };
    },
  }),

  BID: Object.freeze({
    code: "BID",
    copyable: false,
    description: "冻结并提交报价；成交或失败后解冻/扣除。",
    params: {
      player: STR("出价玩家ID"),
      amount: INT("报价数值"),
      asset: STR("用哪种资源下注"),
      bid_id: STR("可选：出价单ID（不传则自动生成）"),
    },
    apply(state, p, ctx) {
      const id = playerIndex(state, p.player);
      const amount = Math.max(0, int(p.amount, "amount"));
      const hold = Number(state.players[id].resources[p.asset] || 0);
      if (hold < amount) {
        fail("EFFECT_INSUFFICIENT", "Not enough resource to place bid", {
          player: id,
          asset: p.asset,
          held: hold,
          amount,
        });
      }
      const bidId = String(p.bid_id ?? ctx.bidId ?? `bid-${Object.keys(state.bids).length + 1}`);
      if (state.bids[bidId]) {
        fail("EFFECT_DUPLICATE_BID", "Bid id already exists", { bidId });
      }
      let after = touchPlayer(state, id, (current) => ({
        ...current,
        resources: { ...current.resources, [p.asset]: hold - amount },
      }));
      after = {
        ...after,
        bids: {
          ...after.bids,
          [bidId]: { playerId: id, amount, assetKey: p.asset, status: "pending", frozen: amount },
        },
      };
      return {
        state: after,
        change: {
          code: "BID",
          bidId,
          player: id,
          amount,
          asset: p.asset,
          status: "pending",
          sourceKey: ctx.source,
        },
      };
    },
  }),

  WITHDRAW: Object.freeze({
    code: "WITHDRAW",
    copyable: false,
    description: "撤销尚未成交的报价；已结算状态不可撤回。",
    params: {
      action_id: STR("要撤销的出价单ID"),
    },
    apply(state, p, ctx) {
      const bid = state.bids[p.action_id];
      if (!bid) fail("EFFECT_BID_UNKNOWN", "Unknown bid id", { actionId: p.action_id });
      if (bid.status !== "pending") {
        fail("EFFECT_ALREADY_SETTLED", "Cannot withdraw a settled bid", {
          actionId: p.action_id,
          status: bid.status,
        });
      }
      const id = playerIndex(state, bid.playerId);
      const hold = Number(state.players[id].resources[bid.assetKey] || 0);
      let after = touchPlayer(state, id, (current) => ({
        ...current,
        resources: { ...current.resources, [bid.assetKey]: hold + bid.amount },
      }));
      const bids = { ...after.bids };
      delete bids[p.action_id];
      after = { ...after, bids };
      return {
        state: after,
        change: { code: "WITHDRAW", actionId: p.action_id, returned: bid.amount, sourceKey: ctx.source },
      };
    },
  }),
});

/**
 * 应用单条效果：按 code 找到实现，执行后把 change 追加进 state.log 并返回新状态。
 */
export function applyEffect(state, effect, ctx = {}) {
  const code = String(effect?.code ?? "");
  const entry = MECHANISM_EFFECT_CATALOG[code];
  if (!entry) fail("EFFECT_UNKNOWN", `Unknown effect code ${code}`, { code });
  const { state: next, change } = entry.apply(state, effect, ctx);
  const log = [...(next.log || []), change];
  return { ...next, log };
}

/**
 * 应用一组效果。SCORE_MULTIPLY 默认在 SCORE_GAIN 之后执行（对应设计库"乘算默认在加算后"）。
 * 施加顺序：加算类先、乘算类后；其余保持传入顺序。每次应用都推进 state.log。
 */
export function applyEffects(state, effects, ctx = {}) {
  const list = Array.isArray(effects) ? effects : [];
  const multiply = [];
  const others = [];
  for (const effect of list) {
    if (String(effect?.code) === "SCORE_MULTIPLY") multiply.push(effect);
    else others.push(effect);
  }
  let current = state;
  for (const effect of [...others, ...multiply]) {
    current = applyEffect(current, effect, ctx);
  }
  return current;
}

/** 给定效果码，返回其目录条目（含 description 与 params 说明），便于文档化/复用提示。 */
export function describeEffect(code) {
  return MECHANISM_EFFECT_CATALOG[String(code ?? "")] || null;
}

/** 把所有效果码的声明导出为纯数据结构，供工作台/提示词使用。 */
export function listEffectDocuments() {
  return Object.values(MECHANISM_EFFECT_CATALOG).map((e) => ({
    code: e.code,
    copyable: e.copyable,
    description: e.description,
    params: Object.fromEntries(
      Object.entries(e.params).map(([key, spec]) => [key, spec.description]),
    ),
  }));
}