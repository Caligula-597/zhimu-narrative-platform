/**
 * 成品机制组装层（第 2 层）
 *
 * 对应机制成品设计库 V2.0「mechanism_template」结构（1.1 节）。
 * 职责：把底层模板（TRANSFER/BID/TIMER/SEALED_CHOICE/VOTE）组合成具体可玩的成品机制，
 *       并在机制层实现"家族专用"的结算规则（自由交易结算 / 明拍最高价 / 暗标第二价格 / 表决计票出口）。
 *
 * 复用原则（与设计库一致）：
 *   - 有基座 → composition 里声明复用；
 *   - 家族差异（胜负判定、叫价规则、第二价格、IRV/门槛）在 settlement / 自定义 action 里写，不碰基座语义。
 *
 * 硬标准（不降低）：
 *   1. 每个机制都声明完整 schema：template_id/family_id/nature/legal_actions/
 *      editable_params/locked_rules/output_fields/settlement。
 *   2. 纯函数、确定性；结算复用原子效果（RESOURCE_LOSS 扣款等），不手写第二份转移逻辑。
 *   3. 异常状态必须输出确定结算码（NO_SALE / SOLD / TIE / TIMEOUT…），不靠主持人现编。
 */

import {
  applyEffect,
} from "./mechanism-effects.js";
import {
  createMechanismState,
  runBaseFlow,
  tallyPlurality,
  tallyThreshold,
  tallyIrv,
  tallyMultiRetain,
  tallyWeighted,
  tallyGroupLayers,
} from "./mechanism-base-templates.js";

export class MechanismTemplateError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "MechanismTemplateError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function fail(code, message, details) {
  throw new MechanismTemplateError(code, message, details);
}

function event(state, record) {
  return { ...state, log: [...(state.log || []), record] };
}

/** 初始化一个机制实例的执行状态（在 createMechanismState 基础上加 mechanism 区域）。 */
export function initMechanismState(templateId, config = {}) {
  const base = createMechanismState(config);
  return {
    ...base,
    mechanism: {
      templateId,
      phase: "open",
      leaderBidId: null,
      result: null,
      ...(config.mechanism || {}),
    },
  };
}

function grantLot(state, winner, lot) {
  if (!lot) return state;
  const held = [...(state.players[winner].held || []), lot];
  return {
    ...state,
    players: { ...state.players, [winner]: { ...state.players[winner], held } },
  };
}

function releaseAllBids(state, bidParams) {
  let s = state;
  for (const id of Object.keys(s.bids)) {
    if (s.bids[id].status === "pending") {
      s = runBaseFlow("BID", "withdraw", s, bidParams, { actionId: id });
    }
  }
  return s;
}

function resOf(state, player, resource) {
  return Number(state.players[player]?.resources[resource] || 0);
}

function priceAt(p, step) {
  return Math.max(p.floor_price, p.start_price - step * p.step);
}

function assertUnderTransferLimit(state, transferParams, resource) {
  const limit = transferParams.transfer_limit;
  if (limit !== null && limit !== undefined) {
    const done = Number(state.transferCounts[resource] || 0);
    if (done >= limit) {
      fail("MECH_TRANSFER_LIMIT", "Resource transfer limit reached", { resource, limit, done });
    }
  }
}

/** 两方各出一个资源互换；整单原子（先校验双方余额，再依次 STEAL）。 */
function swapResources(state, a, b, aRes, aAmt, bRes, bAmt) {
  const aHold = resOf(state, a, aRes);
  const bHold = resOf(state, b, bRes);
  if (aHold < aAmt) fail("EFFECT_INSUFFICIENT", "Not enough resource to exchange", { player: a, resource: aRes, held: aHold, amount: aAmt });
  if (bHold < bAmt) fail("EFFECT_INSUFFICIENT", "Not enough resource to exchange", { player: b, resource: bRes, held: bHold, amount: bAmt });
  let s = applyEffect(state, { code: "STEAL", from: a, to: b, resource: aRes, amount: aAmt });
  s = applyEffect(s, { code: "STEAL", from: b, to: a, resource: bRes, amount: bAmt });
  return s;
}

/** 复用 TRANSFER 完成一次双资源互换，并把双方资源累计进 transfer_limit。 */
function exchangeViaTransfers(state, transferParams, { from, to, giveResource, giveAmount, wantResource, wantAmount }) {
  if (resOf(state, from, giveResource) < giveAmount) {
    fail("EFFECT_INSUFFICIENT", "Not enough resource to exchange", { player: from, resource: giveResource, held: resOf(state, from, giveResource), amount: giveAmount });
  }
  if (resOf(state, to, wantResource) < wantAmount) {
    fail("EFFECT_INSUFFICIENT", "Not enough resource to exchange", { player: to, resource: wantResource, held: resOf(state, to, wantResource), amount: wantAmount });
  }
  assertUnderTransferLimit(state, transferParams, giveResource);
  assertUnderTransferLimit(state, transferParams, wantResource);
  let s = state;
  const i1 = `ex-${Object.keys(s.transfers).length + 1}`;
  s = runBaseFlow("TRANSFER", "propose", s, transferParams, { transferId: i1, resource: giveResource, amount: giveAmount, from, to });
  s = runBaseFlow("TRANSFER", "settle", s, transferParams, { transferId: i1 });
  const i2 = `ex-${Object.keys(s.transfers).length + 1}`;
  s = runBaseFlow("TRANSFER", "propose", s, transferParams, { transferId: i2, resource: wantResource, amount: wantAmount, from: to, to: from });
  s = runBaseFlow("TRANSFER", "settle", s, transferParams, { transferId: i2 });
  return s;
}

function shuffleByRng(arr, rng) {
  const a = [...arr];
  const r = typeof rng === "function" ? rng : Math.random;
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function settleCurrentLot(state, instance) {
  const bidParams = instance.baseParams.BID;
  const p = instance.params;
  const idx = state.mechanism.currentLot ?? 0;
  const lot = p.lots[idx];
  const leaderId = state.mechanism.lotLeaders?.[idx];
  const leader = leaderId ? state.bids[leaderId] : null;
  let s = state;
  let result;
  if (!leader) {
    s = releaseAllBids(s, bidParams);
    result = { lotIndex: idx, lot, status: "NO_SALE" };
  } else {
    const winner = leader.playerId;
    const paid = leader.frozen;
    s = releaseAllBids(s, bidParams);
    s = applyEffect(s, { code: "RESOURCE_LOSS", target: winner, resource: p.freeze_asset, amount: paid });
    s = grantLot(s, winner, lot);
    result = { lotIndex: idx, lot, status: "SOLD", winner, paid };
  }
  const lotResults = [...(s.mechanism.lotResults || []), result];
  const lotLeaders = { ...(s.mechanism.lotLeaders || {}) };
  delete lotLeaders[idx];
  return { state: { ...s, mechanism: { ...s.mechanism, lotResults, lotLeaders } }, result };
}

/** M04 系列辅助：手牌点数求和（牌ID -> 点数由 card_points 配置，A 的软硬转换由宿主在 card_points 里预编码）。 */
function handValue(cards, cardPoints) {
  return (cards || []).reduce((a, c) => a + Number((cardPoints || {})[c] || 0), 0);
}

/** 从服务器牌堆直接取牌（庄家等非玩家实体用；玩家抽牌走 DRAW 效果记录台账）。 */
function takeFromDeck(state, pileKey, count) {
  const pile = [...(state.decks[pileKey] || [])];
  const n = Math.min(Math.max(0, Math.trunc(Number(count) || 0)), pile.length);
  const cards = pile.splice(0, n);
  return { state: { ...state, decks: { ...state.decks, [pileKey]: pile } }, cards };
}

/** 一次成功判定：注入的 rng 返回值 < 成功率即成功。 */
function rollSuccess(state, prob) {
  return state.rng() < Number(prob);
}

/** 在 [min, maxExclusive) 内取一个整数（供服务器目标选择用）。 */
function rollInt(state, min, maxExclusive) {
  return Math.floor(Number(min) + state.rng() * (Number(maxExclusive) - Number(min)));
}

/** 按 rng 把玩家分成两队（奇数人时 A 队多一人）。 */
function splitIntoTwoTeams(state, players) {
  const order = shuffleByRng(players.map(String), state.rng);
  const half = Math.ceil(order.length / 2);
  return { A: order.slice(0, half), B: order.slice(half) };
}

/** M04 桌面游戏与 M06 数值对抗共用的姿态克制关系（进取克迂回，迂回克固守，固守克进取）。 */
const STANCE_BEATS = Object.freeze({ advance: "flank", flank: "fortify", fortify: "advance" });

/** M05-3 图块四向端口 `[N,E,S,W]`（1=开口）按顺时针旋转 r 步后的朝向。 */
function rotatePorts(ports, rotation) {
  const r = ((Math.trunc(rotation) % 4) + 4) % 4;
  return [0, 1, 2, 3].map((d) => (ports || [0, 0, 0, 0])[(d - r + 4) % 4]);
}

/** M05-3 线路拼图的连通图：邻接判定 / 从入口做 BFS / 出口是否开口朝外 / 特殊节点覆盖。 */
function buildTileGraph(params, board) {
  const size = params.board_size;
  const tileById = new Map((params.tiles || []).map((t) => [t.id, t]));
  const grid = {
    portAt(key) {
      const cell = board[key];
      if (!cell) return null;
      const tile = tileById.get(cell.tile);
      if (!tile) return null;
      return rotatePorts(tile.ports, cell.rotation);
    },
    neighbors(x, y) {
      const here = grid.portAt(`${x},${y}`);
      if (!here) return [];
      const out = [];
      const e = grid.portAt(`${x + 1},${y}`);
      if (e && here[1] === 1 && e[3] === 1) out.push(`${x + 1},${y}`);
      const w = grid.portAt(`${x - 1},${y}`);
      if (w && here[3] === 1 && w[1] === 1) out.push(`${x - 1},${y}`);
      const s = grid.portAt(`${x},${y + 1}`);
      if (s && here[2] === 1 && s[0] === 1) out.push(`${x},${y + 1}`);
      const n = grid.portAt(`${x},${y - 1}`);
      if (n && here[0] === 1 && n[2] === 1) out.push(`${x},${y - 1}`);
      return out;
    },
    bfs(startKey) {
      const seen = new Set();
      if (!board[startKey]) return seen;
      const queue = [startKey];
      seen.add(startKey);
      while (queue.length) {
        const key = queue.shift();
        const [x, y] = key.split(",").map(Number);
        for (const nk of grid.neighbors(x, y)) {
          if (!seen.has(nk)) { seen.add(nk); queue.push(nk); }
        }
      }
      return seen;
    },
    outwardOpen(e) {
      const p = grid.portAt(`${e.x},${e.y}`);
      if (!p) return false;
      if ((e.y === 0 && p[0] === 1) || (e.y === size - 1 && p[2] === 1) ||
          (e.x === 0 && p[3] === 1) || (e.x === size - 1 && p[1] === 1)) return true;
      return false;
    },
    specialIn(reachable) {
      let count = 0;
      for (const key of reachable) {
        const cell = board[key];
        const tile = tileById.get(cell.tile);
        if (tile?.special) count += 1;
      }
      return count;
    },
  };
  return grid;
}

/** M06-3 攻守谋姿态克制：攻克谋、谋克守、守克攻。 */
const POSTURE_BEATS = Object.freeze({ attack: "scheme", scheme: "defend", defend: "attack" });

export const MECHANISM_TEMPLATES = Object.freeze({
  "M02-1": Object.freeze({
    template_id: "M02-1",
    family_id: "M02",
    name: "自由交换｜双确认交易所",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1200],
    composition: [
      {
        base: "TRANSFER",
        build: (p) => ({
          resource_types: p.resource_types,
          confirm_mode: "DOUBLE",
          timing: p.timing,
          allow_gift: p.allow_gift,
          per_player_parallel: p.per_player_parallel,
          transfer_limit: p.transfer_limit,
        }),
      },
    ],
    editable_params: {
      resource_types: { type: "list", description: "可交易资源种类", default: ["currency"] },
      timing: { type: "enum", description: "IMMEDIATE=接受即转移，STAGE_END=阶段末统一转移", default: "IMMEDIATE" },
      allow_gift: { type: "bool", description: "是否允许赠送", default: true },
      per_player_parallel: { type: "int", description: "每人并行交易单上限", default: 3 },
      transfer_limit: { type: "int|null", description: "每种资源累计转移上限；null=不限", default: null },
      duration_minutes: { type: "int", description: "阶段时长（分钟，主持备注用）", default: 20 },
    },
    locked_rules: [
      "必须双确认（DOUBLE），单方确认无效",
      "平台只记正式成交，不记录口头承诺",
      "不得为推动剧情强制撮合",
    ],
    legal_actions: [
      { key: "propose", base: "TRANSFER", flow: "propose", description: "建立交易单" },
      { key: "confirm", base: "TRANSFER", flow: "confirm", description: "确认/接受一个交易单" },
      { key: "revoke", base: "TRANSFER", flow: "revoke", description: "撤回未成交交易单" },
    ],
    output_fields: ["最终归属", "成交次数", "未履约交易码"],
    settle(state, instance, ctx) {
      const params = instance.baseParams.TRANSFER;
      let s = state;
      // 统一执行所有已双确认的阶段末交易
      let settk = 0;
      for (const [id, tx] of Object.entries(s.transfers)) {
        if (tx.timing === "STAGE_END" && tx.status === "accepted") {
          s = runBaseFlow("TRANSFER", "settle", s, params, { transferId: id });
          settk += 1;
        }
      }
      const settledTotal = Object.values(s.transfers).filter((t) => t.status === "settled").length;
      const unsettled = Object.values(s.transfers)
        .filter((t) => t.status !== "settled")
        .map((t) => t.id);
      const result = { status: "SETTLED", settledTotal, stageEndSettled: settk, unsettled };
      const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M02-1", phase: "settled", result });
    },
  }),

  "M03-1": Object.freeze({
    template_id: "M03-1",
    family_id: "M03",
    name: "公开递增竞价｜明拍",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [480],
    composition: [
      {
        base: "BID",
        build: (p) => ({
          bid_rule: "INCREMENT",
          visibility: "PUBLIC",
          min_increment: p.min_increment,
          freeze_asset: p.freeze_asset,
        }),
      },
      {
        base: "TIMER",
        build: (p) => ({
          base_duration: p.base_duration,
          extend_on_action: true,
          extend_to: p.extend_to,
          timeout_code: "TIMEOUT",
        }),
      },
    ],
    editable_params: {
      start_price: { type: "int", description: "起拍价", default: 2 },
      min_increment: { type: "int", description: "最低加价幅度", default: 1 },
      extend_to: { type: "int", description: "每次有效出价补时到的剩余秒数", default: 15 },
      base_duration: { type: "int", description: "基础时长（秒）", default: 480 },
      freeze_asset: { type: "str", description: "出价冻结的资源", default: "currency" },
      lot: { type: "str", description: "标的内容ID（预设奖励，开拍前绑定）", default: null },
    },
    locked_rules: [
      "不得由客户端时间决定胜负（服务器时间）",
      "标的结果在开拍前绑定",
      "出价即冻结，新高价释放旧领先者冻结额",
    ],
    legal_actions: [
      {
        key: "bid",
        description: "公开出价（须高于当前领先价 + 加价幅度）",
        run(state, instance, ctx) {
          const bidParams = instance.baseParams.BID;
          const timerParams = instance.baseParams.TIMER;
          const p = instance.params;
          const player = String(ctx.player ?? "");
          const amount = Math.trunc(Number(ctx.amount));
          const leaderId = state.mechanism.leaderBidId;
          const leader = leaderId ? state.bids[leaderId] : null;
          const minRequired = leader ? leader.amount + p.min_increment : p.start_price;
          if (!Number.isFinite(amount) || amount < minRequired) {
            fail("MECH_ACTION_INVALID", "Bid below required amount", { amount, minRequired });
          }
          let s = state;
          // 新高价出现：释放旧领先者冻结额
          if (leader) {
            s = runBaseFlow("BID", "withdraw", s, bidParams, { actionId: leaderId });
          }
          const bidId = String(ctx.bidId ?? `bid-${Object.keys(s.bids).length + 1}`);
          s = runBaseFlow("BID", "bid", s, bidParams, { player: String(player), amount, bidId });
          s = { ...s, mechanism: { ...s.mechanism, leaderBidId: bidId } };
          s = runBaseFlow("TIMER", "extend", s, timerParams, { clockKey: ctx.clockKey ?? "main" });
          return event(s, { mechanism: "M03-1", action: "bid", player, amount, bidId });
        },
      },
    ],
    output_fields: ["胜者", "支付额", "剩余预算", "流拍/成交状态"],
    settle(state, instance, ctx) {
      const bidParams = instance.baseParams.BID;
      const p = instance.params;
      const leaderId = state.mechanism.leaderBidId;
      const leader = leaderId ? state.bids[leaderId] : null;
      if (!leader) {
        let s = releaseAllBids(state, bidParams);
        const result = { status: "NO_SALE" };
        const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", result } };
        return event(next, { mechanism: "M03-1", phase: "settled", result });
      }
      const winner = leader.playerId;
      const paid = leader.frozen;
      let s = releaseAllBids(state, bidParams);
      // 统一退回所有人冻结额后，胜者按成交价扣款（避免重复计费）
      s = applyEffect(s, {
        code: "RESOURCE_LOSS",
        target: winner,
        resource: p.freeze_asset,
        amount: paid,
      });
      s = grantLot(s, winner, p.lot);
      const result = { status: "SOLD", winner, paid, lot: p.lot };
      const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", leaderBidId: null, result } };
      return event(next, { mechanism: "M03-1", phase: "settled", result });
    },
  }),

  "M03-2": Object.freeze({
    template_id: "M03-2",
    family_id: "M03",
    name: "密封报价｜暗标（第二价格）",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [300],
    composition: [
      {
        base: "BID",
        build: (p) => ({
          bid_rule: "SEALED",
          visibility: "SEALED",
          min_increment: 1,
          freeze_asset: p.freeze_asset,
        }),
      },
      {
        base: "SEALED_CHOICE",
        build: () => ({ reveal_visibility: "AGGREGATE_ONLY" }),
      },
    ],
    editable_params: {
      price_rule: { type: "enum", description: "first=第一价格，second=第二价格（默认）", default: "second" },
      min_bid: { type: "int", description: "最低可提交报价", default: 0 },
      freeze_asset: { type: "str", description: "出价冻结的资源", default: "currency" },
      lot: { type: "str", description: "标的内容ID", default: null },
    },
    locked_rules: [
      "结算前不可读取他人报价",
      "主持人无权查看实时报价",
      "未提交视为 0",
    ],
    legal_actions: [
      {
        key: "submit",
        description: "秘密提交报价（冻结资源，可截止前覆盖）",
        run(state, instance, ctx) {
          const bidParams = instance.baseParams.BID;
          const sealedParams = instance.baseParams.SEALED_CHOICE;
          const player = String(ctx.player ?? "");
          const amount = Math.trunc(Number(ctx.amount));
          if (!Number.isFinite(amount) || amount < instance.params.min_bid) {
            fail("MECH_ACTION_INVALID", "Sealed bid below min_bid", {
              amount,
              min: instance.params.min_bid,
            });
          }
          const bidId = String(ctx.bidId ?? `bid-${player}`);
          let s = state;
          // 允许截止前修改：先撤回本人旧报价，再提交新报价
          if (s.bids[bidId] && s.bids[bidId].status === "pending") {
            s = runBaseFlow("BID", "withdraw", s, bidParams, { actionId: bidId });
          }
          s = runBaseFlow("BID", "bid", s, bidParams, { player, amount, bidId });
          s = runBaseFlow("SEALED_CHOICE", "submit", s, sealedParams, {
            sealedKey: ctx.sealedKey ?? "lot",
            player,
            value: amount,
          });
          return event(s, { mechanism: "M03-2", action: "submit", player, amount, bidId });
        },
      },
    ],
    output_fields: ["胜者", "支付额", "匿名报价分布", "平票状态"],
    settle(state, instance, ctx) {
      const sealedParams = instance.baseParams.SEALED_CHOICE;
      const bidParams = instance.baseParams.BID;
      const p = instance.params;
      const sealedKey = ctx.sealedKey ?? "lot";
      const submissions = state.sealedSubmissions[sealedKey] || {};
      const entries = Object.entries(submissions)
        .map(([player, value]) => ({ player, amount: Number(value) }))
        .sort((a, b) => b.amount - a.amount);

      if (entries.length === 0) {
        let s = releaseAllBids(state, bidParams);
        const result = { status: "NO_SALE" };
        const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", result } };
        return event(next, { mechanism: "M03-2", phase: "settled", result });
      }

      // 平票：最高价者有并列 → 需要二次密封报价
      const top = entries[0];
      const tied = entries.filter((e) => e.amount === top.amount);
      if (tied.length > 1) {
        let s = releaseAllBids(state, bidParams);
        const result = { status: "TIE", needsRebid: true, tiedPlayers: tied.map((e) => e.player) };
        const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", result } };
        return event(next, { mechanism: "M03-2", phase: "settled", result });
      }

      const second = entries[1];
      const secondPrice = second ? Math.min(top.amount, second.amount + 1) : top.amount;
      const price = p.price_rule === "first" ? top.amount : secondPrice;

      // 先统一揭示，再统一结算
      let s = runBaseFlow("SEALED_CHOICE", "reveal", state, sealedParams, { sealedKey });
      // 退回所有人冻结额，胜者再按 price 扣款（避免第二价格下胜者被多扣）
      s = releaseAllBids(s, bidParams);
      s = applyEffect(s, {
        code: "RESOURCE_LOSS",
        target: top.player,
        resource: p.freeze_asset,
        amount: price,
      });
      s = grantLot(s, top.player, p.lot);
      const result = { status: "SOLD", winner: top.player, price, secondPrice, priceRule: p.price_rule };
      const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M03-2", phase: "settled", result });
    },
  }),

  "M02-2": Object.freeze({
    template_id: "M02-2",
    family_id: "M02",
    name: "固定比率兑换｜公共兑换台",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [900],
    composition: [],
    editable_params: {
      resource_types: { type: "list", description: "兑换台涉及的资源种类（含投入与产出）", default: ["currency", "item"] },
      exchange_rates: { type: "object", description: "兑换比率，key 为「<投入>:<产出>」，值=获得 1 产出需投入的数量，如 { 'currency:item': 2 }", default: {} },
      public_stock: { type: "object", description: "公共库存，key 为产出资源，如 { 'item': 10 }；空对象=不限库存", default: {} },
      max_exchanges: { type: "int", description: "每人最大兑换次数", default: 3 },
      duration_minutes: { type: "int", description: "阶段时长（分钟，主持备注用）", default: 15 },
    },
    locked_rules: [
      "比率不得由主持人中途修改",
      "兑换台不能成为后续唯一必要内容的唯一入口",
      "扣除与发放必须同一事务完成",
    ],
    legal_actions: [
      {
        key: "exchange",
        description: "投入 from_resource，按固定比率换得 want 单位 to_resource",
        run(state, instance, ctx) {
          const p = instance.params;
          const player = String(ctx.player ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "exchange unknown player", { player });
          const from_resource = String(ctx.from_resource ?? "");
          const to_resource = String(ctx.to_resource ?? "");
          const want = Math.trunc(Number(ctx.want) || 0);
          if (want <= 0) fail("MECH_ACTION_INVALID", "exchange want must be positive", { want });
          const rate = Number(p.exchange_rates[`${from_resource}:${to_resource}`]);
          if (!Number.isFinite(rate) || rate <= 0) {
            fail("MECH_ACTION_INVALID", "No exchange rate for this pair", { pair: `${from_resource}:${to_resource}` });
          }
          const done = Number(state.exchangeCounts[player] || 0);
          if (done >= p.max_exchanges) {
            fail("MECH_EXCHANGE_LIMIT", "Personal exchange limit reached", { player, limit: p.max_exchanges });
          }
          let stock = state.pools[to_resource] ? Number(state.pools[to_resource].total) : undefined;
          if (stock === undefined && p.public_stock[to_resource] !== undefined) {
            stock = Number(p.public_stock[to_resource]);
          }
          if (stock !== undefined && stock < want) {
            fail("MECH_STOCK_EXHAUSTED", "Public stock not enough", { to_resource, stock, want });
          }
          const cost = rate * want;
          if (resOf(state, player, from_resource) < cost) {
            fail("EFFECT_INSUFFICIENT", "Not enough input resource", { player, from_resource, hold: resOf(state, player, from_resource), cost });
          }
          // 同一事务：先校后扣，避免部分成功
          let s = applyEffect(state, { code: "RESOURCE_LOSS", target: player, resource: from_resource, amount: cost });
          s = applyEffect(s, { code: "RESOURCE_GAIN", target: player, resource: to_resource, amount: want });
          if (stock !== undefined) {
            s = { ...s, pools: { ...s.pools, [to_resource]: { resource: to_resource, total: stock - want } } };
          }
          s = { ...s, exchangeCounts: { ...s.exchangeCounts, [player]: done + 1 } };
          return event(s, { mechanism: "M02-2", action: "exchange", player, from_resource, to_resource, cost, want });
        },
      },
    ],
    output_fields: ["剩余库存", "每人兑换次数", "成交回执"],
    settle(state, instance, ctx) {
      const remainingStock = {};
      for (const [res, total] of Object.entries(instance.params.public_stock)) {
        remainingStock[res] = state.pools[res] ? state.pools[res].total : total;
      }
      const result = { status: "SETTLED", remainingStock, exchangeCounts: state.exchangeCounts };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M02-2", phase: "settled", result });
    },
  }),

  "M02-3": Object.freeze({
    template_id: "M02-3",
    family_id: "M02",
    name: "双边密议交易｜限时密谈",
    nature: "HYBRID",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1200],
    composition: [
      {
        base: "TRANSFER",
        build: (p) => ({
          resource_types: p.resource_types,
          confirm_mode: "DOUBLE",
          timing: p.timing,
          allow_gift: true,
          per_player_parallel: p.per_player_parallel,
          transfer_limit: null,
        }),
      },
      {
        base: "TIMER",
        build: (p) => ({
          base_duration: p.talk_duration_seconds,
          extend_on_action: false,
          timeout_code: "TIMEOUT",
        }),
      },
    ],
    editable_params: {
      resource_types: { type: "list", description: "可交易资源种类", default: ["currency"] },
      timing: { type: "enum", description: "IMMEDIATE=接受即转移，STAGE_END=阶段末统一转移", default: "IMMEDIATE" },
      per_player_parallel: { type: "int", description: "每人并行交易单上限", default: 3 },
      max_invites: { type: "int", description: "每人最多发起密谈次数", default: 2 },
      max_accepts: { type: "int", description: "每人最多接受密谈次数", default: 2 },
      talk_duration_seconds: { type: "int", description: "单次密谈时长（秒）", default: 180 },
    },
    locked_rules: [
      "不能让全桌等待一组谈话",
      "不得分析或保存语音内容",
      "只结算交易单，不记录或执行口头承诺",
    ],
    legal_actions: [
      {
        key: "invite",
        description: "向对方发起密谈邀请",
        run(state, instance, ctx) {
          const p = instance.params;
          const inviter = String(ctx.inviter ?? "");
          const invitee = String(ctx.invitee ?? "");
          if (!state.players[inviter] || !state.players[invitee]) fail("MECH_TARGET_UNKNOWN", "invite requires known players", { inviter, invitee });
          if (inviter === invitee) fail("MECH_ACTION_INVALID", "Cannot invite self", { inviter });
          const invites = Object.values(state.talks).filter((t) => t.inviter === inviter && (t.status === "invited" || t.status === "accepted"));
          if (invites.length >= p.max_invites) fail("MECH_INVITE_LIMIT", "Invite limit reached", { inviter, limit: p.max_invites });
          const id = String(ctx.talkId ?? `talk-${Object.keys(state.talks).length + 1}`);
          if (state.talks[id]) fail("MECH_DUPLICATE", `talkId ${id} already exists`, { id });
          const talks = { ...state.talks, [id]: { id, inviter, invitee, status: "invited", remaining: p.talk_duration_seconds } };
          let s = runBaseFlow("TIMER", "start", { ...state, talks }, instance.baseParams.TIMER, { clockKey: id, duration: p.talk_duration_seconds });
          return event(s, { mechanism: "M02-3", action: "invite", id, inviter, invitee });
        },
      },
      {
        key: "accept",
        description: "接受密谈邀请",
        run(state, instance, ctx) {
          const id = String(ctx.talkId ?? "");
          const invitee = String(ctx.player ?? "");
          const talk = state.talks[id];
          if (!talk) fail("MECH_UNKNOWN", "Unknown talkId", { id });
          if (talk.status !== "invited") fail("MECH_ACTION_INVALID", "Talk not inviteable", { id, status: talk.status });
          if (talk.invitee !== invitee) fail("MECH_INVALID_CONFIRMER", "Only invitee can accept", { id, invitee });
          const p = instance.params;
          const accepts = Object.values(state.talks).filter((t) => t.invitee === invitee && t.status === "accepted");
          if (accepts.length >= p.max_accepts) fail("MECH_ACCEPT_LIMIT", "Accept limit reached", { invitee, limit: p.max_accepts });
          const talks = { ...state.talks, [id]: { ...talk, status: "accepted" } };
          return event({ ...state, talks }, { mechanism: "M02-3", action: "accept", id, invitee });
        },
      },
      {
        key: "decline",
        description: "拒绝密谈邀请",
        run(state, instance, ctx) {
          const id = String(ctx.talkId ?? "");
          const talk = state.talks[id];
          if (!talk) fail("MECH_UNKNOWN", "Unknown talkId", { id });
          if (talk.status !== "invited") fail("MECH_ACTION_INVALID", "Talk not inviteable", { id, status: talk.status });
          const talks = { ...state.talks, [id]: { ...talk, status: "declined" } };
          return event({ ...state, talks }, { mechanism: "M02-3", action: "decline", id });
        },
      },
      { key: "propose", base: "TRANSFER", flow: "propose", description: "建立交易单（在密谈内）" },
      { key: "confirm", base: "TRANSFER", flow: "confirm", description: "确认/接受交易单" },
      { key: "revoke", base: "TRANSFER", flow: "revoke", description: "撤回未成交交易单" },
    ],
    output_fields: ["密谈统计", "成交记录", "未履约交易码"],
    settle(state, instance, ctx) {
      const params = instance.baseParams.TRANSFER;
      let s = state;
      let settled = 0;
      for (const [id, tx] of Object.entries(s.transfers)) {
        if (tx.timing === "STAGE_END" && tx.status === "accepted") {
          s = runBaseFlow("TRANSFER", "settle", s, params, { transferId: id });
          settled += 1;
        }
      }
      const talksTotal = Object.keys(s.talks).length;
      const talksAccepted = Object.values(s.talks).filter((t) => t.status === "accepted").length;
      const result = { status: "SETTLED", stageEndSettled: settled, talksTotal, talksAccepted };
      const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M02-3", phase: "settled", result });
    },
  }),

  "M02-4": Object.freeze({
    template_id: "M02-4",
    family_id: "M02",
    name: "公共报价板｜开放市场",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1500],
    composition: [],
    editable_params: {
      resource_types: { type: "list", description: "可报价的资源种类", default: ["currency", "item"] },
      max_offers_per_player: { type: "int", description: "每人有效报价上限", default: 3 },
      allow_counter: { type: "bool", description: "是否允许反报价（替代报价）", default: true },
      hide_poster: { type: "bool", description: "是否隐藏报价发布者", default: false },
    },
    locked_rules: [
      "平台不显示「推荐交换对象」或资源价值",
      "没有买方不是异常",
      "资源被其他交易消耗后相关报价自动失效",
    ],
    legal_actions: [
      {
        key: "offer",
        description: "发布一条报价（提供 give 换 want）",
        run(state, instance, ctx) {
          const p = instance.params;
          const from = String(ctx.from ?? "");
          if (!state.players[from]) fail("MECH_TARGET_UNKNOWN", "offer unknown player", { from });
          const give_resource = String(ctx.give_resource ?? "");
          const want_resource = String(ctx.want_resource ?? "");
          const give_amount = Math.trunc(Number(ctx.give_amount) || 0);
          const want_amount = Math.trunc(Number(ctx.want_amount) || 0);
          if (give_amount <= 0 || want_amount <= 0) fail("MECH_ACTION_INVALID", "offer amounts must be positive", { give_amount, want_amount });
          if (!p.resource_types.includes(give_resource) || !p.resource_types.includes(want_resource)) {
            fail("MECH_ACTION_INVALID", "offer uses non-listed resource", { give_resource, want_resource });
          }
          const active = Object.values(state.offers).filter((o) => o.from === from && o.status === "open");
          if (active.length >= p.max_offers_per_player) {
            fail("MECH_OFFER_LIMIT", "Offer limit reached", { from, limit: p.max_offers_per_player });
          }
          const id = String(ctx.offerId ?? `offer-${Object.keys(state.offers).length + 1}`);
          if (state.offers[id]) fail("MECH_DUPLICATE", `offerId ${id} already exists`, { id });
          const offer = { id, from, give_resource, give_amount, want_resource, want_amount, status: "open" };
          return event({ ...state, offers: { ...state.offers, [id]: offer } }, { mechanism: "M02-4", action: "offer", ...offer });
        },
      },
      {
        key: "accept_offer",
        description: "一键接受报价并成交（双方资源互换）",
        run(state, instance, ctx) {
          const id = String(ctx.offerId ?? "");
          const buyer = String(ctx.player ?? "");
          const offer = state.offers[id];
          if (!offer) fail("MECH_UNKNOWN", "Unknown offerId", { id });
          if (offer.status !== "open") fail("MECH_ACTION_INVALID", "Offer not open", { id, status: offer.status });
          if (offer.from === buyer) fail("MECH_ACTION_INVALID", "Cannot accept own offer", { id, buyer });
          const s = swapResources(state, offer.from, buyer, offer.give_resource, offer.give_amount, offer.want_resource, offer.want_amount);
          const offers = { ...s.offers, [id]: { ...offer, status: "settled" } };
          return event({ ...s, offers }, { mechanism: "M02-4", action: "accept_offer", id, buyer });
        },
      },
      {
        key: "revoke_offer",
        description: "撤回自己未成交的报价",
        run(state, instance, ctx) {
          const id = String(ctx.offerId ?? "");
          const from = String(ctx.player ?? "");
          const offer = state.offers[id];
          if (!offer) fail("MECH_UNKNOWN", "Unknown offerId", { id });
          if (offer.from !== from) fail("MECH_INVALID_CONFIRMER", "Only poster can revoke", { id, from });
          if (offer.status === "settled") fail("MECH_ALREADY_SETTLED", "Settled offer cannot be revoked", { id });
          const offers = { ...state.offers };
          delete offers[id];
          return event({ ...state, offers }, { mechanism: "M02-4", action: "revoke_offer", id });
        },
      },
    ],
    output_fields: ["成交历史", "未成交报价", "个人余额"],
    settle(state, instance, ctx) {
      const settled = Object.values(state.offers).filter((o) => o.status === "settled").length;
      const unsettled = Object.values(state.offers).filter((o) => o.status === "open").map((o) => o.id);
      const result = { status: "SETTLED", settled, unsettled };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M02-4", phase: "settled", result });
    },
  }),

  "M02-5": Object.freeze({
    template_id: "M02-5",
    family_id: "M02",
    name: "受限转移｜一次传递",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [900],
    composition: [
      {
        base: "TRANSFER",
        build: (p) => ({
          resource_types: p.resource_types,
          confirm_mode: "DOUBLE",
          timing: "IMMEDIATE",
          allow_gift: true,
          per_player_parallel: p.per_player_parallel,
          transfer_limit: p.max_transfers,
        }),
      },
    ],
    editable_params: {
      resource_types: { type: "list", description: "具有机制状态的资源种类", default: ["currency"] },
      max_transfers: { type: "int|null", description: "每项资源最大转移次数；1=一次传递", default: 1 },
      allow_borrow: { type: "bool", description: "是否允许借用合同", default: true },
      per_player_parallel: { type: "int", description: "每人并行未成交交易单上限", default: 3 },
    },
    locked_rules: [
      "普通叙事信息不进入此系统",
      "只有具有机制状态的资源才登记",
      "借用物在阶段末自动返还；已消耗的借用物不返还但记录消耗者",
    ],
    legal_actions: [
      {
        key: "transfer",
        description: "发起赠送或借用（单资源，DOUBLE 确认）",
        run(state, instance, ctx) {
          const contract = String(ctx.contract ?? "gift");
          if (!["gift", "borrow"].includes(contract)) fail("MECH_ACTION_INVALID", "contract must be gift or borrow", { contract });
          if (contract === "borrow" && !instance.params.allow_borrow) fail("MECH_ACTION_INVALID", "borrow contract is disabled", {});
          const params = instance.baseParams.TRANSFER;
          const id = String(ctx.transferId ?? `tx-${Object.keys(state.transfers).length + 1}`);
          let s = runBaseFlow("TRANSFER", "propose", state, params, {
            transferId: id,
            resource: ctx.resource,
            amount: ctx.amount,
            from: ctx.from,
            to: ctx.to,
          });
          if (contract === "borrow") {
            s = { ...s, loans: { ...s.loans, [id]: { resource: ctx.resource, amount: Math.trunc(Number(ctx.amount) || 0), from: ctx.from, to: ctx.to, status: "pending" } } };
          }
          return event(s, { mechanism: "M02-5", action: "transfer", id, contract });
        },
      },
      { key: "confirm", base: "TRANSFER", flow: "confirm", description: "对方确认交易单" },
      { key: "revoke", base: "TRANSFER", flow: "revoke", description: "撤回未成交交易单" },
      {
        key: "exchange",
        description: "交换合同：双方各出一资源互换",
        run(state, instance, ctx) {
          const params = instance.baseParams.TRANSFER;
          const s = exchangeViaTransfers(state, params, {
            from: ctx.from,
            to: ctx.to,
            giveResource: ctx.give_resource,
            giveAmount: Math.trunc(Number(ctx.give_amount) || 0),
            wantResource: ctx.want_resource,
            wantAmount: Math.trunc(Number(ctx.want_amount) || 0),
          });
          return event(s, { mechanism: "M02-5", action: "exchange", from: ctx.from, to: ctx.to });
        },
      },
    ],
    output_fields: ["归属", "剩余转移次数", "借用返还记录"],
    settle(state, instance, ctx) {
      let s = state;
      const returns = [];
      for (const [id, loan] of Object.entries(s.loans)) {
        const tx = s.transfers[id];
        if (!tx || tx.status !== "settled") continue;
        if (loan.status === "returned" || loan.status === "consumed") continue;
        const hold = resOf(s, loan.to, loan.resource);
        if (hold >= loan.amount) {
          s = applyEffect(s, { code: "STEAL", from: loan.to, to: loan.from, resource: loan.resource, amount: loan.amount });
          returns.push({ id, resource: loan.resource, amount: loan.amount, returned: true });
          s = { ...s, loans: { ...s.loans, [id]: { ...loan, status: "returned" } } };
        } else {
          returns.push({ id, resource: loan.resource, amount: loan.amount, returned: false, consumedBy: loan.to });
          s = { ...s, loans: { ...s.loans, [id]: { ...loan, status: "consumed" } } };
        }
      }
      const result = { status: "SETTLED", borrowReturns: returns, transferCounts: s.transferCounts };
      const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M02-5", phase: "settled", result });
    },
  }),

  "M02-6": Object.freeze({
    template_id: "M02-6",
    family_id: "M02",
    name: "共享资源池｜公共储备",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1200],
    composition: [
      { base: "SEALED_CHOICE", build: () => ({ reveal_visibility: "AGGREGATE_ONLY" }) },
    ],
    editable_params: {
      pool_resource: { type: "str", description: "池使用的资源键", default: "currency" },
      initial_pool: { type: "int", description: "初始池量", default: 10 },
      rounds: { type: "int", description: "轮数", default: 4 },
      max_deposit_per_round: { type: "int", description: "每轮最大投入", default: 2 },
      max_withdraw_per_round: { type: "int", description: "每轮最大取出", default: 1 },
      thresholds: { type: "object", description: "最终池量映射A/B/C/D档（达到该值即该档）", default: { A: 15, B: 10, C: 5, D: 0 } },
    },
    locked_rules: [
      "不得设置只有满额才继续",
      "不得把拒绝投入直接视为剧情立场",
      "不足不会阻断下一阶段",
    ],
    legal_actions: [
      {
        key: "choose",
        description: "秘密选择投入/取出/不动（同时提交）",
        run(state, instance, ctx) {
          const p = instance.params;
          const sealedParams = instance.baseParams.SEALED_CHOICE;
          const player = String(ctx.player ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "choose unknown player", { player });
          const action = String(ctx.action ?? "none");
          if (!["deposit", "withdraw", "none"].includes(action)) fail("MECH_ACTION_INVALID", "action must be deposit/withdraw/none", { action });
          const amount = action === "none" ? 0 : Math.trunc(Number(ctx.amount) || 0);
          if (action === "deposit" && (amount <= 0 || amount > p.max_deposit_per_round)) {
            fail("MECH_ACTION_INVALID", "deposit exceeds per-round limit", { amount, max: p.max_deposit_per_round });
          }
          if (action === "withdraw" && (amount <= 0 || amount > p.max_withdraw_per_round)) {
            fail("MECH_ACTION_INVALID", "withdraw exceeds per-round limit", { amount, max: p.max_withdraw_per_round });
          }
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          const sealedKey = `round-${round}`;
          return runBaseFlow("SEALED_CHOICE", "submit", state, sealedParams, { sealedKey, player, value: { action, amount } });
        },
      },
      {
        key: "resolve_round",
        description: "统一揭示并结算本轮投入/取出",
        run(state, instance, ctx) {
          const p = instance.params;
          const sealedParams = instance.baseParams.SEALED_CHOICE;
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          const sealedKey = `round-${round}`;
          let s = runBaseFlow("SEALED_CHOICE", "reveal", state, sealedParams, { sealedKey });
          const subs = s.sealedSubmissions[sealedKey] || {};
          const reserveKey = "reserve";
          let pool = s.pools[reserveKey] ? Number(s.pools[reserveKey].total) : Number(p.initial_pool);
          for (const [player, val] of Object.entries(subs)) {
            if (val.action === "deposit") {
              const amt = Math.trunc(Number(val.amount) || 0);
              s = applyEffect(s, { code: "RESOURCE_LOSS", target: player, resource: p.pool_resource, amount: amt });
              pool += amt;
            }
          }
          const withdrawers = Object.entries(subs)
            .filter(([, v]) => v.action === "withdraw" && (Number(v.amount) || 0) > 0)
            .map(([player, v]) => ({ player, amount: Math.trunc(Number(v.amount) || 0) }));
          const totalReq = withdrawers.reduce((a, w) => a + w.amount, 0);
          const alloc = withdrawers.map((w) => ({ player: w.player, amount: 0 }));
          if (totalReq <= pool) {
            for (const w of withdrawers) alloc.find((x) => x.player === w.player).amount = w.amount;
          } else {
            for (const w of withdrawers) alloc.find((x) => x.player === w.player).amount = Math.floor((pool * w.amount) / totalReq);
            let left = pool - alloc.reduce((a, x) => a + x.amount, 0);
            const order = shuffleByRng(withdrawers.map((w) => w.player), s.rng);
            for (const player of order) {
              if (left <= 0) break;
              const w = withdrawers.find((x) => x.player === player);
              const a = alloc.find((x) => x.player === player);
              if (a.amount < w.amount) { a.amount += 1; left -= 1; }
            }
          }
          for (const a of alloc) {
            if (a.amount > 0) {
              s = applyEffect(s, { code: "RESOURCE_GAIN", target: a.player, resource: p.pool_resource, amount: a.amount });
              pool -= a.amount;
            }
          }
          s = { ...s, pools: { ...s.pools, [reserveKey]: { resource: p.pool_resource, total: pool } } };
          return event({ ...s, mechanism: { ...s.mechanism, round: round + 1 } }, { mechanism: "M02-6", action: "resolve_round", round, poolAfter: pool });
        },
      },
    ],
    output_fields: ["最终池量", "档位结果", "个人投入/取出"],
    settle(state, instance, ctx) {
      const p = instance.params;
      const reserveKey = "reserve";
      const total = state.pools[reserveKey] ? Number(state.pools[reserveKey].total) : Number(p.initial_pool);
      let tier = "D";
      for (const t of Object.keys(p.thresholds).sort((a, b) => Number(p.thresholds[b]) - Number(p.thresholds[a]))) {
        if (total >= Number(p.thresholds[t])) { tier = t; break; }
      }
      const result = { status: "SETTLED", poolTotal: total, tier };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M02-6", phase: "settled", result });
    },
  }),

  "M03-3": Object.freeze({
    template_id: "M03-3",
    family_id: "M03",
    name: "降价竞拍｜时钟降价",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [96],
    composition: [
      {
        base: "TIMER",
        build: (p) => ({
          base_duration: p.step_count * p.step_interval_seconds,
          extend_on_action: false,
          timeout_code: "TIMEOUT",
        }),
      },
    ],
    editable_params: {
      start_price: { type: "int", description: "起拍价（最高价）", default: 12 },
      floor_price: { type: "int", description: "最低价（跌到即流拍）", default: 1 },
      step: { type: "int", description: "每次降价幅度", default: 1 },
      step_count: { type: "int", description: "降价档数", default: 12 },
      step_interval_seconds: { type: "int", description: "每档间隔（秒）", default: 8 },
      freeze_asset: { type: "str", description: "支付资源", default: "currency" },
      lot: { type: "str", description: "标的内容ID", default: null },
    },
    locked_rules: [
      "禁止客户端先到先得判定",
      "服务器接收时间决定先后",
    ],
    legal_actions: [
      {
        key: "buy",
        description: "以当前价格立即购买（首个经服务器确认者成交）",
        run(state, instance, ctx) {
          const p = instance.params;
          const player = String(ctx.player ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "buy unknown player", { player });
          if (state.mechanism.status === "sold") fail("MECH_ALREADY_SOLD", "Lot already sold", {});
          const step = Number(state.mechanism.priceStep ?? 0);
          if (step > p.step_count) fail("MECH_NO_SALE", "Price window closed", { step });
          const price = priceAt(p, step);
          if (resOf(state, player, p.freeze_asset) < price) {
            fail("EFFECT_INSUFFICIENT", "Not enough resource to buy", { player, resource: p.freeze_asset, hold: resOf(state, player, p.freeze_asset), price });
          }
          let s = applyEffect(state, { code: "RESOURCE_LOSS", target: player, resource: p.freeze_asset, amount: price });
          s = grantLot(s, player, p.lot);
          s = { ...s, mechanism: { ...s.mechanism, status: "sold", winner: player, paid: price } };
          return event(s, { mechanism: "M03-3", action: "buy", player, price });
        },
      },
      {
        key: "descend",
        description: "价格下降一档（服务器定时驱动）",
        run(state, instance, ctx) {
          const step = Number(state.mechanism.priceStep ?? 0) + 1;
          return event({ ...state, mechanism: { ...state.mechanism, priceStep: step } }, { mechanism: "M03-3", action: "descend", step });
        },
      },
    ],
    output_fields: ["成交价", "胜者", "剩金", "流拍/成交状态"],
    settle(state, instance, ctx) {
      const p = instance.params;
      const sold = state.mechanism.status === "sold";
      const result = sold
        ? { status: "SOLD", winner: state.mechanism.winner, paid: state.mechanism.paid, lot: p.lot }
        : { status: "NO_SALE", lot: p.lot };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M03-3", phase: "settled", result });
    },
  }),

  "M03-4": Object.freeze({
    template_id: "M03-4",
    family_id: "M03",
    name: "多标的连续竞价｜连续拍卖会",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1440],
    composition: [
      {
        base: "BID",
        build: (p) => ({
          bid_rule: p.bid_rule,
          visibility: "PUBLIC",
          min_increment: p.min_increment,
          freeze_asset: p.freeze_asset,
        }),
      },
      {
        base: "TIMER",
        build: (p) => ({
          base_duration: p.lot_duration_seconds,
          extend_on_action: true,
          extend_to: p.extend_to,
          timeout_code: "TIMEOUT",
        }),
      },
    ],
    editable_params: {
      lots: { type: "list", description: "标的ID列表（顺序开局公开）", default: [] },
      bid_rule: { type: "enum", description: "INCREMENT=叫价", default: "INCREMENT" },
      min_increment: { type: "int", description: "最低加价", default: 1 },
      start_price: { type: "int", description: "每件起拍价", default: 2 },
      extend_to: { type: "int", description: "每次出价补时秒数", default: 15 },
      lot_duration_seconds: { type: "int", description: "单件基础时长（秒）", default: 360 },
      freeze_asset: { type: "str", description: "共享预算资源", default: "currency" },
    },
    locked_rules: [
      "不得在看到购买结果后调换后续奖励",
      "不得平均分配避免垄断",
      "已成交项目不回滚",
    ],
    legal_actions: [
      {
        key: "bid",
        description: "对当前标的公开出价",
        run(state, instance, ctx) {
          const p = instance.params;
          const bidParams = instance.baseParams.BID;
          const timerParams = instance.baseParams.TIMER;
          const player = String(ctx.player ?? "");
          const amount = Math.trunc(Number(ctx.amount));
          const idx = state.mechanism.currentLot ?? 0;
          if (idx >= p.lots.length) fail("MECH_CLOSED", "No more lots", { idx });
          const leaderId = state.mechanism.lotLeaders?.[idx];
          const leader = leaderId ? state.bids[leaderId] : null;
          const minRequired = leader ? leader.amount + p.min_increment : p.start_price;
          if (!Number.isFinite(amount) || amount < minRequired) {
            fail("MECH_ACTION_INVALID", "Bid below required amount", { amount, minRequired });
          }
          let s = state;
          if (leader) s = runBaseFlow("BID", "withdraw", s, bidParams, { actionId: leaderId });
          const bidId = String(ctx.bidId ?? `bid-${Object.keys(s.bids).length + 1}`);
          s = runBaseFlow("BID", "bid", s, bidParams, { player, amount, bidId });
          s = { ...s, mechanism: { ...s.mechanism, lotLeaders: { ...(s.mechanism.lotLeaders || {}), [idx]: bidId } } };
          const clockKey = ctx.clockKey ?? `lot-${idx}`;
          if (!s.clocks[clockKey]) {
            s = runBaseFlow("TIMER", "start", s, timerParams, { clockKey, duration: p.lot_duration_seconds });
          }
          s = runBaseFlow("TIMER", "extend", s, timerParams, { clockKey });
          return event(s, { mechanism: "M03-4", action: "bid", player, amount, bidId, lotIndex: idx });
        },
      },
      {
        key: "advance",
        description: "结束当前标的并进入下一件",
        run(state, instance, ctx) {
          const p = instance.params;
          if ((state.mechanism.currentLot ?? 0) >= p.lots.length) fail("MECH_CLOSED", "No more lots to advance", {});
          const settled = settleCurrentLot(state, instance);
          const currentLot = (state.mechanism.currentLot ?? 0) + 1;
          const next = { ...settled.state, mechanism: { ...settled.state.mechanism, currentLot } };
          return event(next, { mechanism: "M03-4", action: "advance", lotResult: settled.result });
        },
      },
    ],
    output_fields: ["每件归属", "累计成交额", "剩余预算"],
    settle(state, instance, ctx) {
      const p = instance.params;
      let s = state;
      if ((s.mechanism.currentLot ?? 0) < p.lots.length) {
        const settled = settleCurrentLot(s, instance);
        s = settled.state;
      }
      const budgets = {};
      for (const pl of Object.keys(s.players)) budgets[pl] = resOf(s, pl, p.freeze_asset);
      const result = { status: "SETTLED", perLot: s.mechanism.lotResults || [], budgets };
      const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M03-4", phase: "settled", result });
    },
  }),

  "M03-5": Object.freeze({
    template_id: "M03-5",
    family_id: "M03",
    name: "非货币竞价｜权限竞价",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [300],
    composition: [
      { base: "SEALED_CHOICE", build: () => ({ reveal_visibility: "AGGREGATE_ONLY" }) },
    ],
    editable_params: {
      payable_assets: { type: "list", description: "可作支付物的资源键列表", default: [] },
      conversion_table: { type: "object", description: "每个支付资源换算分，如 { 'act': 2, 'mark': 3 }", default: {} },
      per_asset_cap: { type: "object", description: "单项支付上限，如 { 'act': 3 }；缺省=不限", default: {} },
      lot: { type: "str", description: "标的内容ID", default: null },
    },
    locked_rules: [
      "口头承诺、未来表演和无法核验的行为不能作为支付物",
    ],
    legal_actions: [
      {
        key: "submit_bid",
        description: "提交组合报价（冻结承诺的可核验状态）",
        run(state, instance, ctx) {
          const p = instance.params;
          const sealedParams = instance.baseParams.SEALED_CHOICE;
          const player = String(ctx.player ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "submit_bid unknown player", { player });
          if (state.commitments[player] && state.commitments[player].status === "pending") {
            fail("MECH_ALREADY_SUBMITTED", "Already submitted", { player });
          }
          const commitments = ctx.commitments || {};
          const keys = Object.keys(commitments);
          if (keys.length === 0) fail("MECH_ACTION_INVALID", "commitments must not be empty", {});
          let score = 0;
          for (const [res, raw] of Object.entries(commitments)) {
            if (!p.payable_assets.includes(res)) fail("MECH_ACTION_INVALID", "Not a payable asset", { res });
            const amt = Math.trunc(Number(raw) || 0);
            if (amt <= 0) fail("MECH_ACTION_INVALID", "commitment amount must be positive", { res, amt });
            if (p.per_asset_cap[res] !== undefined && amt > Number(p.per_asset_cap[res])) {
              fail("MECH_ACTION_INVALID", "commitment exceeds per-asset cap", { res, amt, cap: p.per_asset_cap[res] });
            }
            if (resOf(state, player, res) < amt) fail("EFFECT_INSUFFICIENT", "Not enough payable state", { player, res, hold: resOf(state, player, res), amt });
            score += amt * Number(p.conversion_table[res] || 0);
          }
          let s = state;
          for (const [res, raw] of Object.entries(commitments)) {
            const amt = Math.trunc(Number(raw) || 0);
            s = applyEffect(s, { code: "RESOURCE_LOSS", target: player, resource: res, amount: amt });
          }
          s = { ...s, commitments: { ...s.commitments, [player]: { player, commitments: { ...commitments }, score, status: "pending" } } };
          s = runBaseFlow("SEALED_CHOICE", "submit", s, sealedParams, { sealedKey: ctx.sealedKey ?? "lot", player, value: score });
          return event(s, { mechanism: "M03-5", action: "submit_bid", player, score });
        },
      },
    ],
    output_fields: ["胜者", "支付状态", "换算分", "平票状态"],
    settle(state, instance, ctx) {
      const p = instance.params;
      const sealedParams = instance.baseParams.SEALED_CHOICE;
      const bids = Object.values(state.commitments).filter((c) => c.status === "pending");
      if (bids.length === 0) {
        const result = { status: "NO_SALE" };
        const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
        return event(next, { mechanism: "M03-5", phase: "settled", result });
      }
      const top = bids.slice().sort((a, b) => b.score - a.score)[0];
      const tied = bids.filter((c) => c.score === top.score);
      let s = runBaseFlow("SEALED_CHOICE", "reveal", state, sealedParams, { sealedKey: ctx.sealedKey ?? "lot" });
      if (tied.length > 1) {
        for (const c of bids) {
          for (const [res, raw] of Object.entries(c.commitments)) {
            s = applyEffect(s, { code: "RESOURCE_GAIN", target: c.player, resource: res, amount: Math.trunc(Number(raw) || 0) });
          }
          s = { ...s, commitments: { ...s.commitments, [c.player]: { ...c, status: "refunded" } } };
        }
        const result = { status: "TIE", needsRebid: true, tiedPlayers: tied.map((c) => c.player) };
        const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", result } };
        return event(next, { mechanism: "M03-5", phase: "settled", result });
      }
      for (const c of bids) {
        if (c.player === top.player) {
          s = { ...s, commitments: { ...s.commitments, [c.player]: { ...c, status: "won" } } };
        } else {
          for (const [res, raw] of Object.entries(c.commitments)) {
            s = applyEffect(s, { code: "RESOURCE_GAIN", target: c.player, resource: res, amount: Math.trunc(Number(raw) || 0) });
          }
          s = { ...s, commitments: { ...s.commitments, [c.player]: { ...c, status: "refunded" } } };
        }
      }
      s = grantLot(s, top.player, p.lot);
      const result = { status: "SOLD", winner: top.player, score: top.score, lot: p.lot };
      const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M03-5", phase: "settled", result });
    },
  }),

  "M04-1": Object.freeze({
    template_id: "M04-1",
    family_id: "M04",
    name: "点数牌局｜二十一点",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1500],
    composition: [
      { base: "TIMER", build: (p) => ({ base_duration: p.round_duration_seconds, extend_on_action: false, timeout_code: "TIMEOUT" }) },
    ],
    editable_params: {
      initial_durability: { type: "int", description: "每人起始耐久", default: 10 },
      max_rounds: { type: "int", description: "最大轮数", default: 5 },
      win_damage: { type: "int", description: "玩家胜庄家时庄家损失的耐久", default: 2 },
      natural_bonus: { type: "int", description: "天然21额外对庄家造成的损失", default: 1 },
      lose_damage: { type: "int", description: "玩家败给庄家时玩家损失的耐久", default: 3 },
      dealer_stand_at: { type: "int", description: "庄家停牌点数阈值", default: 17 },
      dealer_durability: { type: "int", description: "庄家起始耐久", default: 20 },
      card_points: { type: "object", description: "牌ID到点数的映射", default: {} },
      deck: { type: "list", description: "完整牌堆的牌ID列表（由服务器种子洗牌）", default: [] },
      round_duration_seconds: { type: "int", description: "单轮行动时长（秒）", default: 120 },
    },
    locked_rules: [
      "随机序列由服务器种子产生，不可临场改动",
      "越界判定（爆牌）不可临场改动",
      "掉线者自动按（点数≥17停牌，否则要牌）执行",
    ],
    legal_actions: [
      {
        key: "new_game",
        description: "洗牌并开始新一局（重置轮次/庄家耐久/统计）",
        run(state, instance, ctx) {
          const p = instance.params;
          const deck = shuffleByRng(p.deck.slice(), state.rng);
          const stats = {};
          const players = {};
          for (const pl of Object.keys(state.players)) {
            stats[pl] = { wins: 0, points: 0 };
            players[pl] = { ...state.players[pl], durability: Math.max(0, Number(p.initial_durability)), maxDurability: Math.max(0, Number(p.initial_durability)), held: [], score: 0 };
          }
          return event(
            {
              ...state,
              players,
              decks: { ...state.decks, main: deck },
              mechanism: { ...state.mechanism, round: 0, dealerDurability: Math.max(0, Number(p.dealer_durability)), dealerHand: [], stats, status: "playing" },
            },
            { mechanism: "M04-1", action: "new_game" },
          );
        },
      },
      {
        key: "deal",
        description: "本轮发牌（每人2张，庄家公开1张）",
        run(state, instance, ctx) {
          const p = instance.params;
          const nextRound = Number(state.mechanism.round ?? 0) + 1;
          if (nextRound > p.max_rounds) fail("MECH_CLOSED", "Round limit reached", { round: nextRound, max: p.max_rounds });
          let s = state;
          let players = s.players;
          for (const pl of Object.keys(state.players)) {
            players = { ...players, [pl]: { ...players[pl], held: [] } };
          }
          s = { ...s, players };
          for (const pl of Object.keys(state.players)) {
            if (s.players[pl].durability <= 0) continue;
            s = applyEffect(s, { code: "DRAW", target: pl, pileKey: "main", count: 2, visibility: "private" });
          }
          const dealer = takeFromDeck(s, "main", 1);
          s = dealer.state;
          s = {
            ...s,
            mechanism: { ...s.mechanism, round: nextRound, dealerHand: dealer.cards, roundResult: null, stood: {} },
          };
          return event(s, { mechanism: "M04-1", action: "deal", round: nextRound });
        },
      },
      {
        key: "hit",
        description: "再要一张牌",
        run(state, instance, ctx) {
          const player = String(ctx.player ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "hit unknown player", { player });
          if ((state.mechanism.round ?? 0) < 1) fail("MECH_ACTION_INVALID", "deal first", {});
          if (state.mechanism.roundResult) fail("MECH_ALREADY_SETTLED", "Round already resolved", {});
          if (state.mechanism.stood?.[player]) fail("MECH_ACTION_INVALID", "Player already stood", { player });
          const s = applyEffect(state, { code: "DRAW", target: player, pileKey: "main", count: 1, visibility: "private" });
          return event(s, { mechanism: "M04-1", action: "hit", player });
        },
      },
      {
        key: "stand",
        description: "停牌",
        run(state, instance, ctx) {
          const player = String(ctx.player ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "stand unknown player", { player });
          if (state.mechanism.roundResult) fail("MECH_ALREADY_SETTLED", "Round already resolved", {});
          const stood = { ...(state.mechanism.stood || {}), [player]: true };
          return event({ ...state, mechanism: { ...state.mechanism, stood } }, { mechanism: "M04-1", action: "stand", player });
        },
      },
      {
        key: "resolve_round",
        description: "庄家按固定规则行动并结算本轮",
        run(state, instance, ctx) {
          const p = instance.params;
          const cp = p.card_points;
          let s = state;
          let dHand = [...(state.mechanism.dealerHand || [])];
          while (handValue(dHand, cp) < p.dealer_stand_at) {
            const r = takeFromDeck(s, "main", 1);
            if (r.cards.length === 0) break;
            s = r.state;
            dHand = [...dHand, ...r.cards];
          }
          const dealer = handValue(dHand, cp);
          let dealerDurability = Number(state.mechanism.dealerDurability ?? p.dealer_durability);
          const stats = { ...(state.mechanism.stats || {}) };
          const results = [];
          let players = s.players;
          for (const pl of Object.keys(state.players)) {
            const cur = state.players[pl];
            const cards = cur.held || [];
            const total = handValue(cards, cp);
            if (cur.durability <= 0) {
              results.push({ player: pl, outcome: "observer", total, dealer });
              continue;
            }
            const natural = cards.length === 2 && total === 21;
            const bust = total > 21;
            let outcome;
            if (bust) outcome = "lose";
            else if (dealer > 21) outcome = "win";
            else if (total > dealer) outcome = "win";
            else if (total < dealer) outcome = "lose";
            else outcome = "push";
            const st = { ...(stats[pl] || { wins: 0, points: 0 }) };
            if (outcome === "win") {
              dealerDurability = Math.max(0, dealerDurability - Number(p.win_damage) - (natural ? Number(p.natural_bonus) : 0));
              st.wins += 1;
              st.points += total;
              players = { ...players, [pl]: { ...players[pl], score: players[pl].score + 1 } };
            } else if (outcome === "lose") {
              players = { ...players, [pl]: { ...players[pl], durability: Math.max(0, players[pl].durability - Number(p.lose_damage)) } };
            }
            stats[pl] = st;
            results.push({ player: pl, outcome, total, dealer, natural });
          }
          s = { ...s, players, mechanism: { ...s.mechanism, dealerHand: dHand, dealerDurability, stats, roundResult: { dealer, results } } };
          return event(s, { mechanism: "M04-1", action: "resolve_round", dealer, results });
        },
      },
    ],
    output_fields: ["名次", "耐久", "胜轮数", "累计点数", "庄家耐久"],
    settle(state, instance, ctx) {
      const p = instance.params;
      const stats = state.mechanism.stats || {};
      const rank = Object.keys(state.players)
        .map((pl) => ({
          player: pl,
          durability: state.players[pl].durability,
          wins: stats[pl]?.wins || 0,
          points: stats[pl]?.points || 0,
        }))
        .sort((a, b) => b.durability - a.durability || b.wins - a.wins || b.points - a.points);
      const result = { status: "SETTLED", rank, dealerDurability: state.mechanism.dealerDurability ?? p.dealer_durability };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M04-1", phase: "settled", result });
    },
  }),

  "M04-2": Object.freeze({
    template_id: "M04-2",
    family_id: "M04",
    name: "承受值竞赛｜极限耐受",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1500],
    composition: [{ base: "SEALED_CHOICE", build: () => ({ reveal_visibility: "PER_PLAYER" }) }],
    editable_params: {
      max_endurance: { type: "int", description: "每人承受上限（达到即退出）", default: 10 },
      rounds: { type: "int", description: "轮数", default: 6 },
      max_level: { type: "int", description: "每轮可选挑战最高级", default: 3 },
      success_probs: { type: "object", description: "各级成功率，key=等级", default: { 1: 1, 2: 0.75, 3: 0.5 } },
      protection_count: { type: "int", description: "每人保护次数", default: 1 },
      protection_reduce: { type: "int", description: "保护使一次失败的承受增量减少的值", default: 2 },
    },
    locked_rules: [
      "仅为虚拟数值，不要求现实饮酒或危险动作",
      "随机由注入 rng 决定，可复现",
    ],
    legal_actions: [
      {
        key: "submit",
        description: "秘密提交本轮挑战等级（0=跳过）",
        run(state, instance, ctx) {
          const p = instance.params;
          const player = String(ctx.player ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "submit unknown player", { player });
          const level = Math.trunc(Number(ctx.level) || 0);
          if (level < 0 || level > p.max_level) fail("MECH_ACTION_INVALID", "level out of range", { level, max: p.max_level });
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          return runBaseFlow("SEALED_CHOICE", "submit", state, instance.baseParams.SEALED_CHOICE, {
            sealedKey: `round-${round}`, player, value: { level },
          });
        },
      },
      {
        key: "predict",
        description: "退出者可预测本轮一名成功者（观战分，不影响冠军）",
        run(state, instance, ctx) {
          const player = String(ctx.player ?? "");
          const target = String(ctx.target ?? "");
          if (!state.players[player] || !state.players[target]) fail("MECH_TARGET_UNKNOWN", "predict requires known players", { player, target });
          const stats = state.mechanism.stats || {};
          if (!stats[player]?.out) fail("MECH_ACTION_INVALID", "Only exited players may predict", { player });
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          const predictions = { ...(state.mechanism.predictions || {}), [`${round}:${player}`]: target };
          return event({ ...state, mechanism: { ...state.mechanism, predictions } }, { mechanism: "M04-2", action: "predict", player, target });
        },
      },
      {
        key: "resolve_round",
        description: "统一判定本轮挑战结果并更新承受/积分/退出",
        run(state, instance, ctx) {
          const p = instance.params;
          const sealedParams = instance.baseParams.SEALED_CHOICE;
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          const sealedKey = `round-${round}`;
          const subs = state.sealedSubmissions[sealedKey] || {};
          const stats = {};
          const protectionLeft = { ...(state.mechanism.protectionLeft || {}) };
          const predictions = state.mechanism.predictions || {};
          const succeeded = new Set();
          for (const pl of Object.keys(state.players)) {
            const st = { ...(state.mechanism.stats?.[pl] || { endurance: 0, out: false, bestLevel: 0, spectator: 0 }) };
            const left = protectionLeft[pl] === undefined ? Number(p.protection_count) : protectionLeft[pl];
            if (!st.out) {
              const level = subs[pl] ? Math.trunc(Number(subs[pl].level) || 0) : 0;
              if (level > 0) {
                const prob = Number(p.success_probs[level]);
                if (rollSuccess(state, prob)) {
                  succeeded.add(pl);
                  st.bestLevel = Math.max(st.bestLevel, level);
                } else {
                  let inc = level + 1;
                  if (left > 0) {
                    inc = Math.max(0, inc - Number(p.protection_reduce));
                    protectionLeft[pl] = left - 1;
                  }
                  st.endurance += inc;
                }
              }
              if (st.endurance >= p.max_endurance) st.out = true;
            }
            stats[pl] = st;
            protectionLeft[pl] = protectionLeft[pl] === undefined ? left : protectionLeft[pl];
          }
          // 观战分：退出者预测正确（预测对象本轮成功）
          let players = { ...state.players };
          for (const [key, target] of Object.entries(predictions)) {
            const [r, predictor] = key.split(":");
            if (Number(r) !== round) continue;
            if (succeeded.has(target)) {
              stats[predictor] = { ...stats[predictor], spectator: (stats[predictor].spectator || 0) + 1 };
            }
          }
          // 成功者得积分
          for (const pl of succeeded) {
            const level = subs[pl] ? Math.trunc(Number(subs[pl].level) || 0) : 0;
            players = { ...players, [pl]: { ...players[pl], score: players[pl].score + level } };
          }
          const s = {
            ...state,
            players,
            mechanism: { ...state.mechanism, round: round + 1, stats, protectionLeft },
          };
          const revealed = runBaseFlow("SEALED_CHOICE", "reveal", s, sealedParams, { sealedKey });
          return event(revealed, { mechanism: "M04-2", action: "resolve_round", round });
        },
      },
    ],
    output_fields: ["积分", "剩余承受空间", "退出者名单", "观战分"],
    settle(state, instance, ctx) {
      const p = instance.params;
      const stats = state.mechanism.stats || {};
      const rank = Object.keys(state.players)
        .map((pl) => ({
          player: pl,
          score: state.players[pl].score,
          remaining: Math.max(0, p.max_endurance - Number(stats[pl]?.endurance || 0)),
          bestLevel: Number(stats[pl]?.bestLevel || 0),
          out: !!stats[pl]?.out,
        }))
        .sort((a, b) => b.score - a.score || b.remaining - a.remaining || b.bestLevel - a.bestLevel);
      const spectator = Object.fromEntries(Object.entries(stats).map(([pl, st]) => [pl, st.spectator || 0]));
      const result = { status: "SETTLED", rank, spectator };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M04-2", phase: "settled", result });
    },
  }),

  "M04-3": Object.freeze({
    template_id: "M04-3",
    family_id: "M04",
    name: "同时选择｜三式博弈",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1200],
    composition: [{ base: "SEALED_CHOICE", build: () => ({ reveal_visibility: "PER_PLAYER" }) }],
    editable_params: {
      rounds: { type: "int", description: "轮数", default: 7 },
      max_per_stance: { type: "int", description: "每种姿态最多使用次数", default: 3 },
      counter_score: { type: "int", description: "克制成功得分", default: 2 },
      same_score: { type: "int", description: "同姿态各得分数", default: 1 },
      gang_threshold: { type: "int", description: "被此人数以上共同选择时获得补偿护盾", default: 3 },
    },
    locked_rules: [
      "所有提交同时公开，不得提前展示他人选择",
      "姿态克制关系固定：进取克迂回、迂回克固守、固守克进取",
    ],
    legal_actions: [
      {
        key: "submit",
        description: "秘密提交姿态与公开目标",
        run(state, instance, ctx) {
          const stances = Object.keys(STANCE_BEATS);
          const player = String(ctx.player ?? "");
          const target = String(ctx.target ?? "");
          const stance = String(ctx.stance ?? "");
          if (!state.players[player] || !state.players[target]) fail("MECH_TARGET_UNKNOWN", "submit requires known player/target", { player, target });
          if (player === target) fail("MECH_ACTION_INVALID", "Cannot target self", { player });
          if (!stances.includes(stance)) fail("MECH_ACTION_INVALID", "Unknown stance", { stance, stances });
          const stats = state.mechanism.stats || {};
          const st = stats[player] || { used: {}, lastTarget: null, targeted: 0 };
          const used = (st.used?.[stance] || 0) + 0;
          if (used >= instance.params.max_per_stance) fail("MECH_STANCE_LIMIT", "Stance usage limit reached", { player, stance, used });
          if (st.lastTarget === target) fail("MECH_ACTION_INVALID", "Cannot target same player in consecutive rounds", { player, target });
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          return runBaseFlow("SEALED_CHOICE", "submit", state, instance.baseParams.SEALED_CHOICE, {
            sealedKey: `round-${round}`, player, value: { stance, target },
          });
        },
      },
      {
        key: "resolve_round",
        description: "统一揭示并结算克制关系、姿态次数与补偿护盾",
        run(state, instance, ctx) {
          const p = instance.params;
          const sealedParams = instance.baseParams.SEALED_CHOICE;
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          const sealedKey = `round-${round}`;
          const subs = state.sealedSubmissions[sealedKey] || {};
          const stats = JSON.parse(JSON.stringify(state.mechanism.stats || {}));
          for (const pl of Object.keys(state.players)) {
            stats[pl] = stats[pl] || { used: {}, lastTarget: null, targeted: 0, comp: 0 };
          }
          const delta = {};
          for (const pl of Object.keys(state.players)) delta[pl] = 0;
          // 目标被选择计数（补偿护盾用）
          const targetCount = {};
          for (const pl of Object.keys(state.players)) targetCount[pl] = 0;
          for (const pl of Object.keys(state.players)) {
            const sub = subs[pl];
            if (!sub) continue;
            targetCount[String(sub.target)] = (targetCount[String(sub.target)] || 0) + 1;
          }
          for (const [attacker, sub] of Object.entries(subs)) {
            const def = subs[String(sub.target)];
            if (!def) continue;
            const aSt = sub.stance;
            const dSt = def.stance;
            if (STANCE_BEATS[aSt] === dSt) delta[attacker] += p.counter_score;
            else if (aSt === dSt) { delta[attacker] += p.same_score; delta[String(sub.target)] += p.same_score; }
            // 否则：攻击者被克制，得 0 分（守方仅在「同姿态」时得分）
            stats[attacker].used = { ...stats[attacker].used, [aSt]: (stats[attacker].used[aSt] || 0) + 1 };
            stats[attacker].lastTarget = String(sub.target);
            stats[String(sub.target)].targeted = (stats[String(sub.target)].targeted || 0) + 1;
          }
          // 反集中：被 >= gang_threshold 人选择者获得补偿护盾（下轮首次被克制时+1抵消）
          for (const pl of Object.keys(targetCount)) {
            if (targetCount[pl] >= p.gang_threshold) stats[pl].comp = (stats[pl].comp || 0) + 1;
          }
          let players = { ...state.players };
          for (const pl of Object.keys(state.players)) {
            let gain = delta[pl] || 0;
            if (gain === 0 && (stats[pl].comp || 0) > 0 && wasCountered(subs, pl)) {
              gain = 1;
              stats[pl].comp -= 1;
            }
            players = { ...players, [pl]: { ...players[pl], score: players[pl].score + gain } };
          }
          const s = runBaseFlow("SEALED_CHOICE", "reveal", { ...state, players }, sealedParams, { sealedKey });
          return event({ ...s, mechanism: { ...s.mechanism, round: round + 1, stats } }, { mechanism: "M04-3", action: "resolve_round", round });
        },
      },
    ],
    output_fields: ["积分", "姿态剩余多样性", "被选择次数", "补偿护盾"],
    settle(state, instance, ctx) {
      const p = instance.params;
      const stats = state.mechanism.stats || {};
      const rank = Object.keys(state.players)
        .map((pl) => {
          const used = stats[pl]?.used || {};
          const diversity = Object.keys(STANCE_BEATS).filter((s) => (used[s] || 0) < p.max_per_stance).length;
          return { player: pl, score: state.players[pl].score, diversity, targeted: stats[pl]?.targeted || 0 };
        })
        .sort((a, b) => b.score - a.score || b.diversity - a.diversity || a.targeted - b.targeted);
      const result = { status: "SETTLED", rank };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M04-3", phase: "settled", result });
    },
  }),

  "M04-4": Object.freeze({
    template_id: "M04-4",
    family_id: "M04",
    name: "顺序夺取｜轮选资源",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1200],
    composition: [],
    editable_params: {
      rounds: { type: "int", description: "轮数（蛇形顺序），默认3", default: 3 },
      extra_resources: { type: "int", description: "每轮公共区比人数多出的资源数", default: 2 },
      resources: { type: "list", description: "资源ID列表（开局前生成，顺序固定）", default: [] },
      resource_score: { type: "object", description: "资源ID到分值映射；缺省=每项1分", default: {} },
    },
    locked_rules: [
      "资源池在开局前生成",
      "主持人不能根据玩家选择替换后续资源",
      "超时自动选取公开基础价值最低且未拥有的资源",
    ],
    legal_actions: [
      {
        key: "start_round",
        description: "设定本轮顺序与公共资源区",
        run(state, instance, ctx) {
          const p = instance.params;
          const roundIdx = Number(ctx.round ?? state.mechanism.round ?? 0);
          if (roundIdx >= p.rounds) fail("MECH_CLOSED", "All rounds done", { roundIdx });
          const n = Object.keys(state.players).length + Number(p.extra_resources);
          const start = roundIdx * n;
          const available = p.resources.slice(start, start + n);
          let order;
          if (roundIdx === 0) order = shuffleByRng(Object.keys(state.players), state.rng);
          else if (roundIdx === 1) order = [...(state.mechanism.order || [])].reverse();
          else {
            order = Object.keys(state.players).slice().sort((a, b) =>
              (state.players[a].score - state.players[b].score) || (state.mechanism.order.indexOf(a) - state.mechanism.order.indexOf(b)));
          }
          return event(
            { ...state, mechanism: { ...state.mechanism, round: roundIdx, order, currentIndex: 0, available, picked: {} } },
            { mechanism: "M04-4", action: "start_round", round: roundIdx, order, available },
          );
        },
      },
      {
        key: "draft",
        description: "当前顺位玩家选取一项公共资源",
        run(state, instance, ctx) {
          const player = String(ctx.player ?? "");
          const resource = String(ctx.resource ?? "");
          const order = state.mechanism.order || [];
          const idx = state.mechanism.currentIndex ?? 0;
          if (order[idx] !== player) fail("MECH_NOT_YOUR_TURN", "Not this player's turn", { player, current: order[idx] });
          if (!(state.mechanism.available || []).includes(resource)) fail("MECH_ACTION_INVALID", "Resource not available", { resource });
          const held = [...(state.players[player].held || []), resource];
          const available = (state.mechanism.available || []).filter((r) => r !== resource);
          const picked = { ...(state.mechanism.picked || {}), [player]: resource };
          const done = idx + 1 >= order.length;
          const s = {
            ...state,
            players: { ...state.players, [player]: { ...state.players[player], held } },
            mechanism: { ...state.mechanism, available, picked, currentIndex: idx + 1, roundDone: done },
          };
          return event(s, { mechanism: "M04-4", action: "draft", player, resource });
        },
      },
      {
        key: "auto_draft",
        description: "超时替当前玩家自动选取基础价值最低的资源",
        run(state, instance, ctx) {
          const p = instance.params;
          const order = state.mechanism.order || [];
          const idx = state.mechanism.currentIndex ?? 0;
          const player = order[idx];
          const available = state.mechanism.available || [];
          if (available.length === 0) fail("MECH_ACTION_INVALID", "No resource to auto-pick", {});
          const resource = available.slice().sort((a, b) =>
            (Number(p.resource_score[a] ?? 1) - Number(p.resource_score[b] ?? 1)))[0];
          const held = [...(state.players[player].held || []), resource];
          const next = available.filter((r) => r !== resource);
          const s = {
            ...state,
            players: { ...state.players, [player]: { ...state.players[player], held } },
            mechanism: { ...state.mechanism, available: next, picked: { ...(state.mechanism.picked || {}), [player]: resource }, currentIndex: idx + 1 },
          };
          return event(s, { mechanism: "M04-4", action: "auto_draft", player, resource });
        },
      },
    ],
    output_fields: ["各玩家所得资源", "积分", "剩余资源"],
    settle(state, instance, ctx) {
      const p = instance.params;
      const rank = Object.keys(state.players)
        .map((pl) => {
          const held = state.players[pl].held || [];
          const score = held.reduce((a, r) => a + Number(p.resource_score[r] ?? 1), 0);
          return { player: pl, held, score };
        })
        .sort((a, b) => b.score - a.score);
      const result = { status: "SETTLED", rank, remaining: state.mechanism.available || [] };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M04-4", phase: "settled", result });
    },
  }),

  "M04-5": Object.freeze({
    template_id: "M04-5",
    family_id: "M04",
    name: "押注与风险推进｜止盈阶梯",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1200],
    composition: [{ base: "SEALED_CHOICE", build: () => ({ reveal_visibility: "PER_PLAYER" }) }],
    editable_params: {
      layers: { type: "int", description: "阶梯层数", default: 5 },
      success_probs: { type: "list", description: "各层成功率（从低层到高层）", default: [0.9, 0.75, 0.6, 0.45, 0.3] },
      rewards: { type: "list", description: "各层未锁收益（从低层到高层）", default: [1, 3, 6, 10, 15] },
      retry_once: { type: "bool", description: "是否允许每人一次重试", default: false },
    },
    locked_rules: [
      "概率与收益开局公开",
      "不得让第一层退出成为稳定最高期望值",
    ],
    legal_actions: [
      {
        key: "submit",
        description: "秘密选择继续或退出",
        run(state, instance, ctx) {
          const p = instance.params;
          const player = String(ctx.player ?? "");
          const action = String(ctx.action ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "submit unknown player", { player });
          if (!["continue", "exit"].includes(action)) fail("MECH_ACTION_INVALID", "action must be continue or exit", { action });
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          if (round >= p.layers) fail("MECH_CLOSED", "Beyond last layer", { round });
          return runBaseFlow("SEALED_CHOICE", "submit", state, instance.baseParams.SEALED_CHOICE, {
            sealedKey: `round-${round}`, player, value: { action },
          });
        },
      },
      {
        key: "resolve_round",
        description: "统一判定：退出锁定收益，继续成功推进、失败清空未锁收益",
        run(state, instance, ctx) {
          const p = instance.params;
          const sealedParams = instance.baseParams.SEALED_CHOICE;
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          const sealedKey = `round-${round}`;
          const subs = state.sealedSubmissions[sealedKey] || {};
          const stats = JSON.parse(JSON.stringify(state.mechanism.stats || {}));
          const prob = Number(p.success_probs[round]);
          const reward = Number(p.rewards[round]);
          for (const pl of Object.keys(state.players)) {
            const st = stats[pl] || { status: "playing", locked: 0, retried: false, reached: 0 };
            if (st.status !== "playing") continue;
            const action = subs[pl] ? subs[pl].action : "exit";
            if (action === "exit") {
              st.locked += reward;
              st.status = "exited";
            } else {
              if (rollSuccess(state, prob)) {
                st.reached = Math.max(st.reached, round);
                if (round + 1 >= p.layers) {
                  st.locked += reward;
                  st.status = "capped";
                }
              } else if (p.retry_once && !st.retried) {
                st.retried = true;
              } else {
                st.status = "failed";
              }
            }
            stats[pl] = st;
          }
          const s = runBaseFlow("SEALED_CHOICE", "reveal", state, sealedParams, { sealedKey });
          return event({ ...s, mechanism: { ...s.mechanism, round: round + 1, stats } }, { mechanism: "M04-5", action: "resolve_round", round });
        },
      },
    ],
    output_fields: ["锁定收益", "最高到达层", "状态（退出/登顶/失败）"],
    settle(state, instance, ctx) {
      const stats = state.mechanism.stats || {};
      const rank = Object.keys(state.players)
        .map((pl) => ({ player: pl, locked: stats[pl]?.locked || 0, reached: stats[pl]?.reached || 0, status: stats[pl]?.status || "playing" }))
        .sort((a, b) => b.locked - a.locked || b.reached - a.reached);
      const result = { status: "SETTLED", rank };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M04-5", phase: "settled", result });
    },
  }),

  "M04-6": Object.freeze({
    template_id: "M04-6",
    family_id: "M04",
    name: "有限信息猜测｜区间侦测",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1200],
    composition: [],
    editable_params: {
      range_min: { type: "int", description: "目标区间下界（含）", default: 1 },
      range_max: { type: "int", description: "目标区间上界（含）", default: 100 },
      public_probes: { type: "int", description: "全桌共享探测次数", default: 8 },
      private_width: { type: "int", description: "私密探测的区间宽度", default: 20 },
    },
    locked_rules: [
      "目标由可复现随机种子生成，不能用剧情答案替代",
      "重复数字由客户端阻止",
    ],
    legal_actions: [
      {
        key: "new_game",
        description: "生成服务器目标并初始化探测边界",
        run(state, instance, ctx) {
          const p = instance.params;
          const target = rollInt(state, p.range_min, Number(p.range_max) + 1);
          return event(
            { ...state, mechanism: { ...state.mechanism, target, lo: p.range_min, hi: p.range_max, publicProbesLeft: p.public_probes, privateDone: {}, hitBy: null } },
            { mechanism: "M04-6", action: "new_game", target },
          );
        },
      },
      {
        key: "probe_public",
        description: "提交一个数字，系统回复高/低/命中",
        run(state, instance, ctx) {
          const p = instance.params;
          const n = Math.trunc(Number(ctx.number));
          if (!Number.isFinite(n)) fail("MECH_ACTION_INVALID", "number must be an integer", {});
          const m = state.mechanism || {};
          if (m.target === undefined) fail("MECH_ACTION_INVALID", "call new_game first", {});
          if ((m.publicProbesLeft ?? 0) <= 0) fail("MECH_NO_PROBES", "Public probes exhausted", {});
          const target = m.target;
          let feedback;
          let lo = m.lo;
          let hi = m.hi;
          if (n === target) feedback = "hit";
          else if (n > target) { feedback = "high"; hi = Math.min(hi, n - 1); }
          else { feedback = "low"; lo = Math.max(lo, n + 1); }
          const next = { ...state, mechanism: { ...m, lo, hi, publicProbesLeft: m.publicProbesLeft - 1, hitBy: feedback === "hit" ? (m.hitBy ?? ctx.player) : m.hitBy } };
          return event(next, { mechanism: "M04-6", action: "probe_public", number: n, feedback });
        },
      },
      {
        key: "probe_private",
        description: "每人一次私密区间探测，系统仅对本人回复在/不在",
        run(state, instance, ctx) {
          const p = instance.params;
          const player = String(ctx.player ?? "");
          const lo = Math.trunc(Number(ctx.lo));
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "probe_private unknown player", { player });
          const m = state.mechanism || {};
          if (m.target === undefined) fail("MECH_ACTION_INVALID", "call new_game first", {});
          if (m.privateDone?.[player]) fail("MECH_ACTION_INVALID", "Private probe already used", { player });
          const hi = lo + Number(p.private_width) - 1;
          const inside = m.target >= lo && m.target <= hi;
          const privateResults = { ...(m.privateResults || {}), [player]: { lo, hi, inside } };
          return event(
            { ...state, mechanism: { ...m, privateDone: { ...(m.privateDone || {}), [player]: true }, privateResults } },
            { mechanism: "M04-6", action: "probe_private", player, lo, hi, inside },
          );
        },
      },
    ],
    output_fields: ["命中者", "公共档位", "剩余区间宽度"],
    settle(state, instance, ctx) {
      const m = state.mechanism || {};
      const width = Math.max(0, (m.hi ?? 0) - (m.lo ?? 0) + 1);
      const hit = !!m.hitBy;
      const result = { status: "SETTLED", hit, hitBy: m.hitBy || null, target: m.target, finalWidth: width };
      const next = { ...state, mechanism: { ...m, phase: "settled", result } };
      return event(next, { mechanism: "M04-6", phase: "settled", result });
    },
  }),

  "M04-7": Object.freeze({
    template_id: "M04-7",
    family_id: "M04",
    name: "团队累计得分｜接力积分",
    nature: "PURE_GAME",
    participation_mode: "TEAM_BY_RULE",
    player_count: { min: 4, max: 9 },
    duration_presets: [1200],
    composition: [{ base: "SEALED_CHOICE", build: () => ({ reveal_visibility: "AGGREGATE_ONLY" }) }],
    editable_params: {
      rounds: { type: "int", description: "轮数", default: 4 },
      sturdy_value: { type: "int", description: "稳健档固定贡献", default: 1 },
      standard_value: { type: "int", description: "标准档成功贡献", default: 2 },
      standard_prob: { type: "number", description: "标准档成功率", default: 0.8 },
      risky_value: { type: "int", description: "冒险档成功贡献", default: 4 },
      risky_prob: { type: "number", description: "冒险档成功率", default: 0.5 },
      combo_bonus: { type: "int", description: "同队三种档位均有人选择时的加分", default: 2 },
    },
    locked_rules: [
      "不公开个人失败明细应作为默认，避免现场变成绩效追责",
      "人数为奇数时少人队每轮获得1点基础补偿",
    ],
    legal_actions: [
      {
        key: "new_game",
        description: "随机分为两队并清零队分",
        run(state, instance, ctx) {
          const teams = splitIntoTwoTeams(state, Object.keys(state.players));
          return event(
            { ...state, mechanism: { ...state.mechanism, teams, teamScore: { A: 0, B: 0 }, teamSuccess: { A: 0, B: 0 }, round: 0 } },
            { mechanism: "M04-7", action: "new_game", teams },
          );
        },
      },
      {
        key: "submit",
        description: "秘密选择本轮的贡献档位",
        run(state, instance, ctx) {
          const player = String(ctx.player ?? "");
          const tier = String(ctx.tier ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "submit unknown player", { player });
          if (!["sturdy", "standard", "risky"].includes(tier)) fail("MECH_ACTION_INVALID", "tier must be sturdy/standard/risky", { tier });
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          return runBaseFlow("SEALED_CHOICE", "submit", state, instance.baseParams.SEALED_CHOICE, {
            sealedKey: `round-${round}`, player, value: { tier },
          });
        },
      },
      {
        key: "resolve_round",
        description: "结算个人贡献、协作加分并累加队分",
        run(state, instance, ctx) {
          const p = instance.params;
          const sealedParams = instance.baseParams.SEALED_CHOICE;
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          const sealedKey = `round-${round}`;
          const subs = state.sealedSubmissions[sealedKey] || {};
          const teamScore = { ...(state.mechanism.teamScore || { A: 0, B: 0 }) };
          const teamSuccess = { ...(state.mechanism.teamSuccess || { A: 0, B: 0 }) };
          const teams = state.mechanism.teams || { A: [], B: [] };
          // 少人队补偿
          const compensation = teams.A.length !== teams.B.length ? 1 : 0;
          const smallTeam = teams.A.length < teams.B.length ? "A" : "B";
          for (const team of ["A", "B"]) {
            const members = teams[team];
            let score = 0;
            const tiers = new Set();
            for (const pl of members) {
              const tier = subs[pl] ? subs[pl].tier : "sturdy";
              tiers.add(tier);
              if (tier === "sturdy") { score += p.sturdy_value; teamSuccess[team] += 1; }
              else if (tier === "standard") { if (rollSuccess(state, p.standard_prob)) { score += p.standard_value; teamSuccess[team] += 1; } }
              else { if (rollSuccess(state, p.risky_prob)) { score += p.risky_value; teamSuccess[team] += 1; } }
            }
            if (tiers.size === 3) score += p.combo_bonus;
            teamScore[team] += score;
          }
          if (compensation) teamScore[smallTeam] += compensation;
          const s = runBaseFlow("SEALED_CHOICE", "reveal", state, sealedParams, { sealedKey });
          return event({ ...s, mechanism: { ...s.mechanism, round: round + 1, teamScore, teamSuccess } }, { mechanism: "M04-7", action: "resolve_round", round, teamScore });
        },
      },
    ],
    output_fields: ["队分", "成功次数", "胜队", "个人贡献"],
    settle(state, instance, ctx) {
      const teamScore = state.mechanism.teamScore || { A: 0, B: 0 };
      const teamSuccess = state.mechanism.teamSuccess || { A: 0, B: 0 };
      let winner;
      if (teamScore.A === teamScore.B) winner = teamSuccess.A === teamSuccess.B ? "BOTH" : (teamSuccess.A > teamSuccess.B ? "A" : "B");
      else winner = teamScore.A > teamScore.B ? "A" : "B";
      const result = { status: "SETTLED", teamScore, teamSuccess, winner };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M04-7", phase: "settled", result });
    },
  }),

  "M05-1": Object.freeze({
    template_id: "M05-1",
    family_id: "M05",
    name: "集齐指定组合｜组合提交台",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1200],
    composition: [],
    editable_params: {
      component_categories: { type: "list", description: "组件类别列表（组件ID以「类别:序号」命名）", default: ["core", "trait", "proof"] },
      groups: { type: "list", description: "目标组合列表，每项 { id, required: {类别:数量}, result }", default: [] },
      consume: { type: "bool", description: "成交后是否消耗组件", default: true },
      tier_labels: { type: "list", description: "完成 0/1/2/3… 组对应的档位标签", default: ["D", "C", "B", "A"] },
    },
    locked_rules: [
      "每组独立成功",
      "必要结果至少有一组可由公共组件或替代件完成",
      "单人可以独立凑齐，系统不强制共享",
    ],
    legal_actions: [
      {
        key: "setup",
        description: "按 params.groups 初始化目标组合台",
        run(state, instance, ctx) {
          const groups = {};
          for (const g of instance.params.groups || []) {
            groups[g.id] = { id: g.id, required: g.required, result: g.result, status: "open", pool: {}, contributions: [] };
          }
          return event({ ...state, mechanism: { ...state.mechanism, groups } }, { mechanism: "M05-1", action: "setup", groups: Object.keys(groups) });
        },
      },
      {
        key: "give",
        description: "把手中一个组件赠与他人（组件不属于规则资源，走 held 直接转移）",
        run(state, instance, ctx) {
          const from = String(ctx.from ?? "");
          const to = String(ctx.to ?? "");
          const component = String(ctx.component ?? "");
          if (!state.players[from] || !state.players[to]) fail("MECH_TARGET_UNKNOWN", "give requires known from/to", { from, to });
          const held = state.players[from].held || [];
          if (!held.includes(component)) fail("MECH_ACTION_INVALID", "Component not held", { from, component });
          const s = {
            ...state,
            players: {
              ...state.players,
              [from]: { ...state.players[from], held: held.filter((c) => c !== component) },
              [to]: { ...state.players[to], held: [...(state.players[to].held || []), component] },
            },
          };
          return event(s, { mechanism: "M05-1", action: "give", from, to, component });
        },
      },
      {
        key: "contribute",
        description: "向一个目标组合投入一个所需类别的组件",
        run(state, instance, ctx) {
          const player = String(ctx.player ?? "");
          const groupId = String(ctx.group ?? "");
          const component = String(ctx.component ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "contribute unknown player", { player });
          const group = (state.mechanism.groups || {})[groupId];
          if (!group) fail("MECH_ACTION_INVALID", "Unknown group", { group: groupId });
          if (group.status === "completed") fail("MECH_ACTION_INVALID", "Group already completed", { group: groupId });
          const category = component.split(":")[0];
          const pool = group.pool || {};
          if ((pool[category] || 0) >= Number(group.required[category] || 0)) fail("MECH_ACTION_INVALID", "Category already fulfilled", { category, group: groupId });
          const held = state.players[player].held || [];
          if (!held.includes(component)) fail("MECH_ACTION_INVALID", "Component not held", { player, component });
          const groups = {
            ...(state.mechanism.groups || {}),
            [groupId]: { ...group, pool: { ...pool, [category]: (pool[category] || 0) + 1 }, contributions: [...(group.contributions || []), { player, category, component }] },
          };
          const s = {
            ...state,
            players: { ...state.players, [player]: { ...state.players[player], held: held.filter((c) => c !== component) } },
            mechanism: { ...state.mechanism, groups },
          };
          return event(s, { mechanism: "M05-1", action: "contribute", group: groupId, player, component });
        },
      },
      {
        key: "resolve_group",
        description: "验证目标组合是否集齐；集齐则开放预设结果并（按配置）消耗组件",
        run(state, instance, ctx) {
          const p = instance.params;
          const groupId = String(ctx.group ?? "");
          const groups = state.mechanism.groups || {};
          const group = groups[groupId];
          if (!group) fail("MECH_ACTION_INVALID", "Unknown group", { group: groupId });
          if (group.status === "completed") return state;
          const missing = Object.entries(group.required).filter(([cat, need]) => (group.pool?.[cat] || 0) < Number(need));
          if (missing.length > 0) fail("MECH_INCOMPLETE", "Group not complete", { group: groupId, missing: missing.map(([c]) => c) });
          let s = state;
          let contributions = group.contributions || [];
          if (!p.consume) {
            let players = { ...s.players };
            for (const c of contributions) {
              players = { ...players, [c.player]: { ...players[c.player], held: [...(players[c.player].held || []), c.component] } };
            }
            contributions = [];
            s = { ...s, players };
          }
          const groups2 = { ...groups, [groupId]: { ...group, status: "completed", pool: {}, contributions } };
          s = { ...s, mechanism: { ...s.mechanism, groups: groups2 } };
          return event(s, { mechanism: "M05-1", action: "resolve_group", group: groupId, result: group.result });
        },
      },
    ],
    output_fields: ["完成组数", "档位", "各组结果"],
    settle(state, instance, ctx) {
      const p = instance.params;
      const groups = state.mechanism.groups || {};
      const completed = Object.values(groups).filter((g) => g.status === "completed").map((g) => g.result);
      const tier = p.tier_labels[completed.length] ?? p.tier_labels[p.tier_labels.length - 1] ?? "D";
      const result = { status: "SETTLED", completedGroups: completed.length, completed, tier };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M05-1", phase: "settled", result });
    },
  }),

  "M05-2": Object.freeze({
    template_id: "M05-2",
    family_id: "M05",
    name: "顺序排列｜序列复原",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1200],
    composition: [],
    editable_params: {
      fragments: { type: "list", description: "片段ID列表（6—9 张），服务器据此生成目标顺序", default: [] },
      max_submissions: { type: "int", description: "最多正式提交次数", default: 3 },
    },
    locked_rules: [
      "反馈只返回正确位置数量与相邻关系正确数量",
      "片段之间必须含内部判断依据，不能只靠穷举",
    ],
    legal_actions: [
      {
        key: "new_game",
        description: "洗出目标顺序并清零提交计数",
        run(state, instance, ctx) {
          const target = shuffleByRng(instance.params.fragments.map(String), state.rng);
          return event({ ...state, mechanism: { ...state.mechanism, target, submissions: [], best: null, solved: false } }, { mechanism: "M05-2", action: "new_game", target });
        },
      },
      {
        key: "submit",
        description: "正式提交一次排列，得到位置与相邻反馈",
        run(state, instance, ctx) {
          const target = state.mechanism.target || [];
          const order = Array.isArray(ctx.order) ? ctx.order.map(String) : [];
          const n = target.length;
          if (n === 0) fail("MECH_ACTION_INVALID", "new_game must run first", {});
          const permOk = order.length === n && new Set(order).size === n && order.every((x) => target.includes(x));
          if (!permOk) fail("MECH_ACTION_INVALID", "order must be a permutation of fragments", { order });
          const submissions = state.mechanism.submissions || [];
          if (submissions.length >= instance.params.max_submissions) fail("MECH_SUBMIT_LIMIT", "Submission limit reached", { limit: instance.params.max_submissions });
          let correctPos = 0;
          for (let i = 0; i < n; i += 1) if (order[i] === target[i]) correctPos += 1;
          let adjacency = 0;
          for (let i = 0; i < n - 1; i += 1) {
            const a = target[i], b = target[i + 1];
            for (let j = 0; j < n - 1; j += 1) if (order[j] === a && order[j + 1] === b) { adjacency += 1; break; }
          }
          const scored = { correctPos, adjacency };
          const best = state.mechanism.best && state.mechanism.best.correctPos > correctPos ? state.mechanism.best : scored;
          const next = {
            ...state,
            mechanism: { ...state.mechanism, submissions: [...submissions, { order, ...scored }], best, solved: correctPos === n || state.mechanism.solved },
          };
          return event(next, { mechanism: "M05-2", action: "submit", correctPos, adjacency });
        },
      },
    ],
    output_fields: ["最优正确位置数", "相邻正确数", "提交次数", "档位"],
    settle(state, instance, ctx) {
      const best = state.mechanism.best || { correctPos: 0, adjacency: 0 };
      const n = (state.mechanism.target || []).length;
      let tier;
      if (state.mechanism.solved || best.correctPos === n) tier = "A";
      else if (best.correctPos >= n - 2) tier = "B";
      else if (best.adjacency >= 1) tier = "C";
      else tier = "D";
      const result = { status: "SETTLED", best, tier, submissions: (state.mechanism.submissions || []).length };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M05-2", phase: "settled", result });
    },
  }),

  "M05-3": Object.freeze({
    template_id: "M05-3",
    family_id: "M05",
    name: "空间拼合｜线路拼图",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1500],
    composition: [],
    editable_params: {
      board_size: { type: "int", description: "正方形棋盘边长", default: 4 },
      tiles: { type: "list", description: "图块列表，每项 { id, ports:[N,E,S,W], special? }（1=开口）", default: [] },
      entrance: { type: "object", description: "入口格 { x, y }", default: { x: 0, y: 0 } },
      exits: { type: "list", description: "出口格列表 { x, y }", default: [] },
      max_tiles: { type: "int", description: "最多可放置图块数", default: 12 },
    },
    locked_rules: [
      "图块集开局固定，不能由主持人悄悄补一块",
      "图块可旋转，不可重叠",
      "系统只标记合法连接，不提示最优路线",
    ],
    legal_actions: [
      {
        key: "place",
        description: "把一个图块（可选旋转）放到某个空格",
        run(state, instance, ctx) {
          const p = instance.params;
          const tileId = String(ctx.tile ?? "");
          const tile = (p.tiles || []).find((t) => t.id === tileId);
          if (!tile) fail("MECH_ACTION_INVALID", "Unknown tile", { tile: tileId });
          const x = Math.trunc(Number(ctx.x)), y = Math.trunc(Number(ctx.y)), rotation = Math.trunc(Number(ctx.rotation ?? 0));
          if (x < 0 || x >= p.board_size || y < 0 || y >= p.board_size) fail("MECH_ACTION_INVALID", "Out of bounds", { x, y });
          if (rotation < 0 || rotation > 3) fail("MECH_ACTION_INVALID", "rotation must be 0-3", { rotation });
          const board = state.mechanism.board || {};
          if (board[`${x},${y}`]) fail("MECH_ACTION_INVALID", "Cell occupied", { x, y });
          if (Object.keys(board).length >= Number(p.max_tiles)) fail("MECH_LIMIT", "Tile count limit reached", { limit: p.max_tiles });
          const next = { ...board, [`${x},${y}`]: { tile: tileId, rotation } };
          return event({ ...state, mechanism: { ...state.mechanism, board: next } }, { mechanism: "M05-3", action: "place", tile: tileId, x, y, rotation });
        },
      },
      {
        key: "remove",
        description: "移除指定格子的图块",
        run(state, instance, ctx) {
          const x = Math.trunc(Number(ctx.x)), y = Math.trunc(Number(ctx.y));
          const board = state.mechanism.board || {};
          if (!board[`${x},${y}`]) fail("MECH_ACTION_INVALID", "Cell empty", { x, y });
          const next = { ...board };
          delete next[`${x},${y}`];
          return event({ ...state, mechanism: { ...state.mechanism, board: next } }, { mechanism: "M05-3", action: "remove", x, y });
        },
      },
      {
        key: "submit",
        description: "按连通性计算连通出口与特殊节点覆盖",
        run(state, instance, ctx) {
          const p = instance.params;
          const grid = buildTileGraph(p, state.mechanism.board || {});
          const entranceKey = `${p.entrance.x},${p.entrance.y}`;
          const reachable = grid.bfs(entranceKey);
          const linkedExits = (p.exits || []).filter((e) => reachable.has(`${e.x},${e.y}`) && grid.outwardOpen(e)).length;
          const specialCoverage = grid.specialIn(reachable);
          const emptyCells = p.board_size * p.board_size - Object.keys(state.mechanism.board || {}).length;
          return event({ ...state, mechanism: { ...state.mechanism, linkedExits, specialCoverage, emptyCells } }, { mechanism: "M05-3", action: "submit", linkedExits, specialCoverage, emptyCells });
        },
      },
    ],
    output_fields: ["连通出口数", "特殊节点覆盖", "剩余空位"],
    settle(state, instance, ctx) {
      const result = { status: "SETTLED", linkedExits: state.mechanism.linkedExits ?? 0, specialCoverage: state.mechanism.specialCoverage ?? 0, emptyCells: state.mechanism.emptyCells ?? 0 };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M05-3", phase: "settled", result });
    },
  }),

  "M05-4": Object.freeze({
    template_id: "M05-4",
    family_id: "M05",
    name: "多条件激活｜接口矩阵",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1200],
    composition: [],
    editable_params: {
      interfaces: { type: "list", description: "接口列表，每项 { id, require: {标签维度:值} }", default: [] },
      component_tags: { type: "object", description: "组件ID -> { color, shape, value, source }", default: {} },
      required_matches: { type: "int", description: "每个接口需满足的标签维度数", default: 2 },
      consume: { type: "bool", description: "正式提交后是否消耗组件", default: true },
      tier_labels: { type: "list", description: "满足 0/1/2/3… 个接口对应的结果标签", default: ["D", "C", "B", "A"] },
    },
    locked_rules: [
      "至少存在两套合法解",
      "系统只显示条件是否满足，不显示哪个标签错误",
      "任何单一组件被持有或消耗都不应使最低结果不可达",
    ],
    legal_actions: [
      {
        key: "assign",
        description: "把一个组件拖入某个接口并即时判定是否满足",
        run(state, instance, ctx) {
          const p = instance.params;
          const player = String(ctx.player ?? "");
          const component = String(ctx.component ?? "");
          const ifaceId = String(ctx.interface ?? "");
          const iface = (p.interfaces || []).find((i) => i.id === ifaceId);
          if (!iface) fail("MECH_ACTION_INVALID", "Unknown interface", { interface: ifaceId });
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "assign unknown player", { player });
          const tags = p.component_tags[component];
          if (!tags) fail("MECH_ACTION_INVALID", "Component has no tags", { component });
          const held = state.players[player].held || [];
          if (!held.includes(component)) fail("MECH_ACTION_INVALID", "Component not held", { player, component });
          const matches = Object.entries(iface.require || {}).filter(([dim, val]) => val != null && String(tags[dim]) === String(val)).length;
          const satisfied = matches >= Number(p.required_matches);
          const assignments = { ...(state.mechanism.assignments || {}), [ifaceId]: { player, component, matches, satisfied } };
          const s = {
            ...state,
            players: { ...state.players, [player]: { ...state.players[player], held: held.filter((c) => c !== component) } },
            mechanism: { ...state.mechanism, assignments },
          };
          return event(s, { mechanism: "M05-4", action: "assign", interface: ifaceId, player, component, satisfied });
        },
      },
      {
        key: "withdraw",
        description: "撤回某个接口上的组件",
        run(state, instance, ctx) {
          const ifaceId = String(ctx.interface ?? "");
          const assignments = state.mechanism.assignments || {};
          const a = assignments[ifaceId];
          if (!a) fail("MECH_ACTION_INVALID", "No assignment", { interface: ifaceId });
          const assignments2 = { ...assignments };
          delete assignments2[ifaceId];
          const s = {
            ...state,
            players: { ...state.players, [a.player]: { ...state.players[a.player], held: [...(state.players[a.player].held || []), a.component] } },
            mechanism: { ...state.mechanism, assignments: assignments2 },
          };
          return event(s, { mechanism: "M05-4", action: "withdraw", interface: ifaceId });
        },
      },
      {
        key: "submit",
        description: "正式激活：按满足接口数量生成档位并（按配置）消耗组件",
        run(state, instance, ctx) {
          const p = instance.params;
          const assignments = state.mechanism.assignments || {};
          const satisfiedCount = Object.values(assignments).filter((a) => a.satisfied).length;
          let s = state;
          if (!p.consume) {
            let players = { ...s.players };
            for (const a of Object.values(assignments)) {
              players = { ...players, [a.player]: { ...players[a.player], held: [...(players[a.player].held || []), a.component] } };
            }
            s = { ...s, players };
          }
          const tier = p.tier_labels[satisfiedCount] ?? p.tier_labels[p.tier_labels.length - 1] ?? "D";
          return event({ ...s, mechanism: { ...s.mechanism, phase: "submitted", satisfiedCount, tier } }, { mechanism: "M05-4", action: "submit", satisfiedCount, tier });
        },
      },
    ],
    output_fields: ["满足接口数", "结果档位"],
    settle(state, instance, ctx) {
      const result = { status: "SETTLED", satisfiedCount: state.mechanism.satisfiedCount ?? 0, tier: state.mechanism.tier ?? "D" };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M05-4", phase: "settled", result });
    },
  }),

  "M05-5": Object.freeze({
    template_id: "M05-5",
    family_id: "M05",
    name: "可替代组件｜配方网络",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1200],
    composition: [],
    editable_params: {
      targets: { type: "list", description: "目标列表，每项 { id, result }", default: [] },
      core_resource: { type: "string", description: "核心件资源键", default: "core" },
      generic_resource: { type: "string", description: "通用件资源键", default: "generic" },
      core_cost: { type: "int", description: "核心件完成一个目标所需数量", default: 1 },
      generic_cost: { type: "int", description: "通用件完成一个目标所需数量", default: 3 },
    },
    locked_rules: [
      "替代方案必须有真实成本差异，不能仅改名称",
      "核心件并非必然优于通用件方案",
    ],
    legal_actions: [
      {
        key: "craft",
        description: "选择一个目标与配方，消耗物料并产出结果",
        run(state, instance, ctx) {
          const p = instance.params;
          const player = String(ctx.player ?? "");
          const targetId = String(ctx.target ?? "");
          const recipe = String(ctx.recipe ?? "core");
          const target = (p.targets || []).find((t) => t.id === targetId);
          if (!target) fail("MECH_ACTION_INVALID", "Unknown target", { target: targetId });
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "craft unknown player", { player });
          const completed = state.mechanism.completed || {};
          if (completed[targetId]) fail("MECH_ACTION_INVALID", "Target already completed", { target: targetId });
          let resource, cost;
          if (recipe === "core") { resource = p.core_resource; cost = Number(p.core_cost); }
          else if (recipe === "generic") { resource = p.generic_resource; cost = Number(p.generic_cost); }
          else fail("MECH_ACTION_INVALID", "recipe must be core or generic", { recipe });
          const held = Number(state.players[player].resources[resource] || 0);
          if (held < cost) fail("EFFECT_INSUFFICIENT", "Not enough resources to craft", { player, resource, held, cost });
          let s = applyEffect(state, { code: "RESOURCE_LOSS", target: player, resource, amount: cost });
          const produced = [...(s.mechanism.produced || []), { target: targetId, result: target.result, player }];
          s = { ...s, mechanism: { ...s.mechanism, completed: { ...completed, [targetId]: true }, produced } };
          return event(s, { mechanism: "M05-5", action: "craft", player, target: targetId, recipe, result: target.result });
        },
      },
    ],
    output_fields: ["完成目标数", "剩余资源", "目标结果"],
    settle(state, instance, ctx) {
      const completed = Object.keys(state.mechanism.completed || {});
      const remaining = Object.fromEntries(Object.keys(state.players).map((pl) => [pl, { ...(state.players[pl].resources || {}) }]));
      const result = { status: "SETTLED", completedTargets: completed.length, completed, remainingResources: remaining };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M05-5", phase: "settled", result });
    },
  }),

  "M05-6": Object.freeze({
    template_id: "M05-6",
    family_id: "M05",
    name: "分阶段拼接｜递进组件",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1200],
    composition: [],
    editable_params: {
      part_resource: { type: "string", description: "拼接用的基础物料资源键", default: "part" },
      stage1_targets: { type: "list", description: "第一阶段局部组合，每项 { id, result }", default: [] },
      stage1_cost: { type: "int", description: "每个局部组合消耗的基础物料数", default: 2 },
      stage2_options: { type: "list", description: "第二阶段方案，每项 { id, result }，只需任意两个中间件", default: [] },
    },
    locked_rules: [
      "第一阶段每个结果永久有效",
      "仅得到一个中间件时仍有低档出口",
      "后段只增加用途，不推翻前段客观内容",
    ],
    legal_actions: [
      {
        key: "produce_stage1",
        description: "消耗基础物料，生成一个中间件",
        run(state, instance, ctx) {
          const p = instance.params;
          const player = String(ctx.player ?? "");
          const stId = String(ctx.stage1 ?? "");
          const target = (p.stage1_targets || []).find((t) => t.id === stId);
          if (!target) fail("MECH_ACTION_INVALID", "Unknown stage1 target", { stage1: stId });
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "produce unknown player", { player });
          const mids = state.mechanism.mids || {};
          if (mids[stId]) fail("MECH_ACTION_INVALID", "Intermediate already produced", { stage1: stId });
          const held = Number(state.players[player].resources[p.part_resource] || 0);
          if (held < Number(p.stage1_cost)) fail("EFFECT_INSUFFICIENT", "Not enough material", { player, need: p.stage1_cost, held });
          let s = applyEffect(state, { code: "RESOURCE_LOSS", target: player, resource: p.part_resource, amount: Number(p.stage1_cost) });
          const mids2 = { ...mids, [stId]: target.result };
          s = {
            ...s,
            players: { ...s.players, [player]: { ...s.players[player], held: [...(s.players[player].held || []), target.result] } },
            mechanism: { ...s.mechanism, mids: mids2 },
          };
          return event(s, { mechanism: "M05-6", action: "produce_stage1", player, stage1: stId, mid: target.result });
        },
      },
      {
        key: "combine_stage2",
        description: "消耗任意两个中间件，完成一个第二阶段方案",
        run(state, instance, ctx) {
          const p = instance.params;
          const player = String(ctx.player ?? "");
          const optId = String(ctx.option ?? "");
          const mid1 = String(ctx.mid1 ?? "");
          const mid2 = String(ctx.mid2 ?? "");
          const option = (p.stage2_options || []).find((o) => o.id === optId);
          if (!option) fail("MECH_ACTION_INVALID", "Unknown stage2 option", { option: optId });
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "combine unknown player", { player });
          if (mid1 === mid2) fail("MECH_ACTION_INVALID", "mid1 and mid2 must differ", {});
          const held = state.players[player].held || [];
          if (!held.includes(mid1) || !held.includes(mid2)) fail("MECH_ACTION_INVALID", "Intermediates not held", { player, mid1, mid2 });
          const finals = [...(state.mechanism.finals || []), { option: optId, result: option.result, player }];
          const s = {
            ...state,
            players: { ...state.players, [player]: { ...state.players[player], held: held.filter((c) => c !== mid1 && c !== mid2) } },
            mechanism: { ...state.mechanism, finals },
          };
          return event(s, { mechanism: "M05-6", action: "combine_stage2", player, option: optId, result: option.result });
        },
      },
    ],
    output_fields: ["已生成中间件", "已完成第二阶段方案", "档位"],
    settle(state, instance, ctx) {
      const mids = Object.keys(state.mechanism.mids || {});
      const finals = state.mechanism.finals || [];
      let tier;
      if (finals.length >= 1) tier = "HIGH";
      else if (mids.length >= 2) tier = "MID";
      else if (mids.length === 1) tier = "LOW";
      else tier = "NONE";
      const result = { status: "SETTLED", mids, finals: finals.map((f) => f.result), tier };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M05-6", phase: "settled", result });
    },
  }),

  "M06-1": Object.freeze({
    template_id: "M06-1",
    family_id: "M06",
    name: "基础生命对抗｜十点生存战",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1800],
    composition: [{ base: "SEALED_CHOICE", build: () => ({ reveal_visibility: "PER_PLAYER" }) }],
    editable_params: {
      max_durability: { type: "int", description: "基础生命上限", default: 10 },
      attack_value: { type: "int", description: "攻击基础伤害", default: 2 },
      defense_reduce: { type: "int", description: "防御降低的首轮伤害", default: 2 },
      charge_bonus: { type: "int", description: "蓄力后下轮攻击加成", default: 2 },
      heal_value: { type: "int", description: "急救恢复量（每人一次）", default: 2 },
      rounds: { type: "int", description: "轮数上限", default: 6 },
      actions: { type: "list", description: "可选行动列表", default: ["attack", "defend", "charge", "heal"] },
    },
    locked_rules: [
      "伤害同时生效，淘汰检查在轮末统一进行",
      "归零者不再成为攻击目标",
      "不得中途复活或临时改伤害",
    ],
    legal_actions: [
      {
        key: "submit",
        description: "秘密提交行动与（攻击所需）目标",
        run(state, instance, ctx) {
          const p = instance.params;
          const player = String(ctx.player ?? "");
          const action = String(ctx.action ?? "");
          const target = String(ctx.target ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "submit unknown player", { player });
          if (!p.actions.includes(action)) fail("MECH_ACTION_INVALID", "Unknown action", { action });
          if (action === "attack") {
            if (!state.players[target]) fail("MECH_TARGET_UNKNOWN", "attack requires known target", { target });
            if (target === player) fail("MECH_ACTION_INVALID", "Cannot attack self", {});
            if (state.players[target].durability <= 0) fail("MECH_ACTION_INVALID", "Cannot target eliminated player", { target });
          }
          if (action === "heal" && (state.mechanism.healUsed || {})[player]) fail("MECH_ACTION_INVALID", "heal already used", { player });
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          return runBaseFlow("SEALED_CHOICE", "submit", state, instance.baseParams.SEALED_CHOICE, { sealedKey: `round-${round}`, player, value: { action, target } });
        },
      },
      {
        key: "resolve_round",
        description: "同时结算防御、伤害、恢复与淘汰",
        run(state, instance, ctx) {
          const p = instance.params;
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          const key = `round-${round}`;
          const subs = state.sealedSubmissions[key] || {};
          const charged = state.mechanism.charged || {};
          const healUsed = { ...(state.mechanism.healUsed || {}) };
          const dealt = { ...(state.mechanism.dealt || {}) };
          const incoming = {};
          const nextCharged = {};
          const healers = [];
          for (const pl of Object.keys(state.players)) incoming[pl] = 0;
          for (const [pl, sub] of Object.entries(subs)) {
            const action = sub.action;
            if (action === "attack") {
              const t = String(sub.target ?? "");
              const dmg = Number(p.attack_value) + (charged[pl] ? Number(p.charge_bonus) : 0);
              incoming[t] += dmg;
              dealt[pl] = (dealt[pl] || 0) + dmg;
            } else if (action === "charge") {
              nextCharged[pl] = true;
            } else if (action === "heal") {
              if (healUsed[pl]) fail("MECH_ACTION_INVALID", "heal already used", { player: pl });
              healUsed[pl] = true;
              healers.push(pl);
            }
          }
          let players = { ...state.players };
          for (const pl of Object.keys(players)) {
            let net = incoming[pl] || 0;
            if ((subs[pl] || {}).action === "defend") net = Math.max(0, net - Number(p.defense_reduce));
            if (net > 0) players = { ...players, [pl]: { ...players[pl], durability: Math.max(0, players[pl].durability - net) } };
          }
          for (const pl of healers) {
            players = { ...players, [pl]: { ...players[pl], durability: Math.min(Number(p.max_durability), players[pl].durability + Number(p.heal_value)) } };
          }
          const s = runBaseFlow("SEALED_CHOICE", "reveal", { ...state, players }, instance.baseParams.SEALED_CHOICE, { sealedKey: key });
          return event({ ...s, mechanism: { ...s.mechanism, round: round + 1, charged: nextCharged, healUsed, dealt } }, { mechanism: "M06-1", action: "resolve_round", round });
        },
      },
    ],
    output_fields: ["剩余生命", "造成有效伤害", "剩余一次性能力"],
    settle(state, instance, ctx) {
      const dealt = state.mechanism.dealt || {};
      const healUsed = state.mechanism.healUsed || {};
      const rank = Object.keys(state.players)
        .map((pl) => ({ player: pl, durability: state.players[pl].durability, dealt: dealt[pl] || 0, abilityLeft: healUsed[pl] ? 0 : 1 }))
        .sort((a, b) => b.durability - a.durability || b.dealt - a.dealt || b.abilityLeft - a.abilityLeft);
      const result = { status: "SETTLED", rank, eliminated: rank.filter((r) => r.durability <= 0).map((r) => r.player) };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M06-1", phase: "settled", result });
    },
  }),

  "M06-2": Object.freeze({
    template_id: "M06-2",
    family_id: "M06",
    name: "行动点对抗｜三点指令",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1500],
    composition: [{ base: "SEALED_CHOICE", build: () => ({ reveal_visibility: "PER_PLAYER" }) }],
    editable_params: {
      action_points: { type: "int", description: "每轮行动点", default: 3 },
      rounds: { type: "int", description: "轮数", default: 5 },
      same_action_cap: { type: "int", description: "同一行动单轮最多使用次数", default: 2 },
      attack_value: { type: "int", description: "每点攻击的伤害", default: 1 },
      energy_boost: { type: "int", description: "蓄能后下轮攻击加成", default: 1 },
      actions: { type: "list", description: "可选行动", default: ["attack", "defend", "move", "support", "charge"] },
    },
    locked_rules: [
      "未用点数清零",
      "非法组合在提交前阻止",
      "所有行动必须有消费者",
    ],
    legal_actions: [
      {
        key: "submit",
        description: "秘密分配行动点，攻击/支援需要目标",
        run(state, instance, ctx) {
          const p = instance.params;
          const player = String(ctx.player ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "submit unknown player", { player });
          const alloc = ctx.alloc || {};
          let total = 0;
          for (const [k, raw] of Object.entries(alloc)) {
            if (!p.actions.includes(k)) fail("MECH_ACTION_INVALID", "Unknown action", { action: k });
            const v = Math.trunc(Number(raw) || 0);
            if (v < 0) fail("MECH_ACTION_INVALID", "Negative allocation", { action: k });
            if (v > Number(p.same_action_cap)) fail("MECH_ACTION_INVALID", "Same action cap exceeded", { action: k, v });
            total += (k === "charge" ? 2 : 1) * v;
          }
          if (total > Number(p.action_points)) fail("MECH_ACTION_INVALID", "Action points exceeded", { total, cap: p.action_points });
          if ((alloc.attack || 0) > 0 || (alloc.support || 0) > 0) {
            const target = String(ctx.target ?? "");
            if (!state.players[target]) fail("MECH_TARGET_UNKNOWN", "attack/support requires target", { target });
          }
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          return runBaseFlow("SEALED_CHOICE", "submit", state, instance.baseParams.SEALED_CHOICE, { sealedKey: `round-${round}`, player, value: { alloc, target: String(ctx.target ?? "") } });
        },
      },
      {
        key: "resolve_round",
        description: "结算伤害、支援、蓄能与移动得分",
        run(state, instance, ctx) {
          const p = instance.params;
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          const key = `round-${round}`;
          const subs = state.sealedSubmissions[key] || {};
          const energy = { ...(state.mechanism.energy || {}) };
          const incoming = {};
          const nextEnergy = {};
          for (const pl of Object.keys(state.players)) incoming[pl] = 0;
          for (const [pl, sub] of Object.entries(subs)) {
            const alloc = sub.alloc || {};
            const attack = Math.min(Number(p.same_action_cap), Math.trunc(alloc.attack || 0));
            const dmg = attack * Number(p.attack_value) + (attack > 0 ? (energy[pl] || 0) : 0);
            if (dmg > 0) incoming[String(sub.target || "")] += dmg;
            if (Math.trunc(alloc.charge || 0) > 0) nextEnergy[pl] = (nextEnergy[pl] || 0) + 1;
          }
          let players = { ...state.players };
          for (const pl of Object.keys(players)) {
            let net = incoming[pl] || 0;
            net = Math.max(0, net - Math.trunc((subs[pl]?.alloc?.defend) || 0));
            if (net > 0) players = { ...players, [pl]: { ...players[pl], durability: Math.max(0, players[pl].durability - net) } };
          }
          for (const [pl, sub] of Object.entries(subs)) {
            const alloc = sub.alloc || {};
            const attack = Math.min(Number(p.same_action_cap), Math.trunc(alloc.attack || 0));
            const support = Math.min(Number(p.same_action_cap), Math.trunc(alloc.support || 0));
            const move = Math.min(Number(p.same_action_cap), Math.trunc(alloc.move || 0));
            let gained = move;
            if (attack > 0) gained += attack * Number(p.attack_value) + (energy[pl] || 0);
            if (support > 0) {
              const t = String(sub.target || "");
              players = { ...players, [t]: { ...players[t], score: players[t].score + support } };
              gained += support;
            }
            players = { ...players, [pl]: { ...players[pl], score: players[pl].score + gained } };
          }
          const s = runBaseFlow("SEALED_CHOICE", "reveal", { ...state, players }, instance.baseParams.SEALED_CHOICE, { sealedKey: key });
          return event({ ...s, mechanism: { ...s.mechanism, round: round + 1, energy: nextEnergy } }, { mechanism: "M06-2", action: "resolve_round", round });
        },
      },
    ],
    output_fields: ["积分", "剩余生命", "能量"],
    settle(state, instance, ctx) {
      const rank = Object.keys(state.players)
        .map((pl) => ({ player: pl, score: state.players[pl].score, durability: state.players[pl].durability }))
        .sort((a, b) => b.score - a.score || b.durability - a.durability);
      const result = { status: "SETTLED", rank };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M06-2", phase: "settled", result });
    },
  }),

  "M06-3": Object.freeze({
    template_id: "M06-3",
    family_id: "M06",
    name: "姿态克制｜攻守谋三势",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1500],
    composition: [{ base: "SEALED_CHOICE", build: () => ({ reveal_visibility: "PER_PLAYER" }) }],
    editable_params: {
      rounds: { type: "int", description: "轮数", default: 7 },
      counter_score: { type: "int", description: "克制成功获得优势", default: 2 },
      same_score: { type: "int", description: "同姿态各得防备", default: 1 },
      fatigue: { type: "int", description: "连续同姿态效果衰减", default: 1 },
      win_threshold: { type: "int", description: "优势达到该值提前获胜", default: 8 },
      stances: { type: "list", description: "姿态列表", default: ["attack", "scheme", "defend"] },
    },
    locked_rules: [
      "必须有历史选择反馈，避免纯猜拳",
      "姿态克制关系固定：攻克谋、谋克守、守克攻",
    ],
    legal_actions: [
      {
        key: "submit",
        description: "秘密提交姿态与公开目标",
        run(state, instance, ctx) {
          const p = instance.params;
          const player = String(ctx.player ?? "");
          const target = String(ctx.target ?? "");
          const stance = String(ctx.stance ?? "");
          if (!state.players[player] || !state.players[target]) fail("MECH_TARGET_UNKNOWN", "submit requires known player/target", { player, target });
          if (player === target) fail("MECH_ACTION_INVALID", "Cannot target self", {});
          if (!p.stances.includes(stance)) fail("MECH_ACTION_INVALID", "Unknown stance", { stance });
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          return runBaseFlow("SEALED_CHOICE", "submit", state, instance.baseParams.SEALED_CHOICE, { sealedKey: `round-${round}`, player, value: { stance, target } });
        },
      },
      {
        key: "resolve_round",
        description: "统一揭示并结算克制、防备与连续姿态疲劳",
        run(state, instance, ctx) {
          const p = instance.params;
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          const key = `round-${round}`;
          const subs = state.sealedSubmissions[key] || {};
          const lastStance = state.mechanism.lastStance || {};
          const nextLast = {};
          const delta = {};
          for (const pl of Object.keys(state.players)) delta[pl] = 0;
          for (const [attacker, sub] of Object.entries(subs)) {
            const def = subs[String(sub.target)];
            nextLast[attacker] = sub.stance;
            if (!def) continue;
            const aSt = sub.stance;
            const dSt = def.stance;
            let gain = 0;
            if (POSTURE_BEATS[aSt] === dSt) gain = Number(p.counter_score);
            else if (aSt === dSt) gain = Number(p.same_score);
            if (lastStance[attacker] === aSt) gain = Math.max(0, gain - Number(p.fatigue));
            delta[attacker] += gain;
            if (aSt === dSt) {
              const t = String(sub.target);
              let tGain = Number(p.same_score);
              if (lastStance[t] === dSt) tGain = Math.max(0, tGain - Number(p.fatigue));
              delta[t] += tGain;
            }
          }
          let players = { ...state.players };
          for (const pl of Object.keys(players)) {
            players = { ...players, [pl]: { ...players[pl], score: players[pl].score + (delta[pl] || 0) } };
          }
          const s = runBaseFlow("SEALED_CHOICE", "reveal", { ...state, players }, instance.baseParams.SEALED_CHOICE, { sealedKey: key });
          return event({ ...s, mechanism: { ...s.mechanism, round: round + 1, lastStance: { ...lastStance, ...nextLast } } }, { mechanism: "M06-3", action: "resolve_round", round });
        },
      },
    ],
    output_fields: ["优势", "连续姿态", "被选择次数"],
    settle(state, instance, ctx) {
      const p = instance.params;
      const rank = Object.keys(state.players).map((pl) => ({ player: pl, advantage: state.players[pl].score })).sort((a, b) => b.advantage - a.advantage);
      const winner = rank[0]?.advantage >= Number(p.win_threshold) ? rank[0].player : null;
      const result = { status: "SETTLED", rank, earlyWinner: winner };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M06-3", phase: "settled", result });
    },
  }),

  "M06-4": Object.freeze({
    template_id: "M06-4",
    family_id: "M06",
    name: "队伍对抗｜双线攻防",
    nature: "PURE_GAME",
    participation_mode: "TEAM_BY_RULE",
    player_count: { min: 4, max: 9 },
    duration_presets: [1500],
    composition: [{ base: "SEALED_CHOICE", build: () => ({ reveal_visibility: "AGGREGATE_ONLY" }) }],
    editable_params: {
      fortress_durability: { type: "int", description: "每队堡垒耐久", default: 12 },
      rounds: { type: "int", description: "轮数", default: 5 },
      attack_value: { type: "int", description: "每人进攻造成的伤害", default: 1 },
      supply_strength: { type: "int", description: "每个强化令为下轮进攻加成", default: 1 },
    },
    locked_rules: [
      "同队选择分布仅结算后公开",
      "提前失利者不退出整场",
      "结果只在固定结算点产生",
    ],
    legal_actions: [
      {
        key: "new_game",
        description: "随机分为两队并重置堡垒",
        run(state, instance, ctx) {
          const teams = splitIntoTwoTeams(state, Object.keys(state.players));
          return event({ ...state, mechanism: { ...state.mechanism, teams, fortress: { A: Number(instance.params.fortress_durability), B: Number(instance.params.fortress_durability) }, supply: { A: 0, B: 0 }, round: 0 } }, { mechanism: "M06-4", action: "new_game", teams });
        },
      },
      {
        key: "submit",
        description: "秘密选择进攻、防守或补给",
        run(state, instance, ctx) {
          const player = String(ctx.player ?? "");
          const action = String(ctx.action ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "submit unknown player", { player });
          if (!["attack", "defend", "supply"].includes(action)) fail("MECH_ACTION_INVALID", "action must be attack/defend/supply", { action });
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          return runBaseFlow("SEALED_CHOICE", "submit", state, instance.baseParams.SEALED_CHOICE, { sealedKey: `round-${round}`, player, value: { action } });
        },
      },
      {
        key: "resolve_round",
        description: "结算进攻减防守后的堡垒损伤与补给强化",
        run(state, instance, ctx) {
          const p = instance.params;
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          const key = `round-${round}`;
          const subs = state.sealedSubmissions[key] || {};
          const teams = state.mechanism.teams || { A: [], B: [] };
          const supplyIn = { ...(state.mechanism.supply || { A: 0, B: 0 }) };
          const counts = { A: { attack: 0, defend: 0, supply: 0 }, B: { attack: 0, defend: 0, supply: 0 } };
          for (const pl of Object.keys(state.players)) {
            const team = teams.A.includes(pl) ? "A" : "B";
            const action = (subs[pl] || {}).action || "defend";
            counts[team][action] += 1;
          }
          const atkA = counts.A.attack * Number(p.attack_value) + supplyIn.A * Number(p.supply_strength);
          const atkB = counts.B.attack * Number(p.attack_value) + supplyIn.B * Number(p.supply_strength);
          const dmgToB = Math.max(0, atkA - counts.B.defend);
          const dmgToA = Math.max(0, atkB - counts.A.defend);
          const fortress = {
            A: Math.max(0, (state.mechanism.fortress?.A ?? 0) - dmgToA),
            B: Math.max(0, (state.mechanism.fortress?.B ?? 0) - dmgToB),
          };
          const supply = { A: counts.A.supply, B: counts.B.supply };
          const s = runBaseFlow("SEALED_CHOICE", "reveal", state, instance.baseParams.SEALED_CHOICE, { sealedKey: key });
          return event({ ...s, mechanism: { ...s.mechanism, round: round + 1, fortress, supply } }, { mechanism: "M06-4", action: "resolve_round", round, fortress, dmgToA, dmgToB });
        },
      },
    ],
    output_fields: ["堡垒耐久", "强化令", "胜队"],
    settle(state, instance, ctx) {
      const f = state.mechanism.fortress || { A: 0, B: 0 };
      let winner;
      if (f.A === 0 && f.B === 0) winner = "BOTH_DOWN";
      else if (f.A === 0) winner = "B";
      else if (f.B === 0) winner = "A";
      else if (f.A === f.B) winner = "TIE";
      else winner = f.A > f.B ? "A" : "B";
      const result = { status: "SETTLED", fortress: f, winner };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M06-4", phase: "settled", result });
    },
  }),

  "M06-5": Object.freeze({
    template_id: "M06-5",
    family_id: "M06",
    name: "多方混战｜积分混战",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1500],
    composition: [{ base: "SEALED_CHOICE", build: () => ({ reveal_visibility: "PER_PLAYER" }) }],
    editable_params: {
      rounds: { type: "int", description: "轮数", default: 5 },
      raid_score: { type: "int", description: "突袭成功得分", default: 2 },
      guard_score: { type: "int", description: "护持得分", default: 1 },
      max_raid_scorers: { type: "int", description: "同一目标最多得分攻击者数", default: 3 },
    },
    locked_rules: [
      "不能通过围攻最弱者无限获利",
      "不采用永久淘汰",
      "最低分玩家获得追赶标记",
    ],
    legal_actions: [
      {
        key: "submit",
        description: "秘密选择突袭（带目标）、护持（带目标）、休整或转移",
        run(state, instance, ctx) {
          const player = String(ctx.player ?? "");
          const action = String(ctx.action ?? "");
          const target = String(ctx.target ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "submit unknown player", { player });
          if (!["raid", "guard", "rest", "shift"].includes(action)) fail("MECH_ACTION_INVALID", "action must be raid/guard/rest/shift", { action });
          if ((action === "raid" || action === "guard") && (!state.players[target] || target === player)) fail("MECH_ACTION_INVALID", "raid/guard requires valid distinct target", { target });
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          return runBaseFlow("SEALED_CHOICE", "submit", state, instance.baseParams.SEALED_CHOICE, { sealedKey: `round-${round}`, player, value: { action, target } });
        },
      },
      {
        key: "resolve_round",
        description: "结算突袭得分、护持抵消与休整充能",
        run(state, instance, ctx) {
          const p = instance.params;
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          const key = `round-${round}`;
          const subs = state.sealedSubmissions[key] || {};
          const charged = { ...(state.mechanism.charged || {}) };
          const raiders = {};
          const guards = {};
          let players = { ...state.players };
          for (const [pl, sub] of Object.entries(subs)) {
            const t = String(sub.target || "");
            if (sub.action === "raid") (raiders[t] = raiders[t] || []).push(pl);
            else if (sub.action === "guard") {
              guards[t] = (guards[t] || 0) + 1;
              players = { ...players, [pl]: { ...players[pl], score: players[pl].score + Number(p.guard_score) } };
            } else if (sub.action === "rest") {
              return void (charged[pl] = true);
            }
          }
          for (const [t, list] of Object.entries(raiders)) {
            const ordered = list.slice().sort();
            const active = ordered.slice(guards[t] || 0);
            const scorers = active.slice(0, Number(p.max_raid_scorers));
            for (const pl of scorers) {
              const gain = Number(p.raid_score) + (charged[pl] ? 1 : 0);
              players = { ...players, [pl]: { ...players[pl], score: players[pl].score + gain } };
            }
          }
          const s = runBaseFlow("SEALED_CHOICE", "reveal", { ...state, players }, instance.baseParams.SEALED_CHOICE, { sealedKey: key });
          return event({ ...s, mechanism: { ...s.mechanism, round: round + 1, charged } }, { mechanism: "M06-5", action: "resolve_round", round });
        },
      },
    ],
    output_fields: ["积分", "追赶标记"],
    settle(state, instance, ctx) {
      const rank = Object.keys(state.players).map((pl) => ({ player: pl, score: state.players[pl].score })).sort((a, b) => b.score - a.score);
      const result = { status: "SETTLED", rank };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M06-5", phase: "settled", result });
    },
  }),

  "M06-6": Object.freeze({
    template_id: "M06-6",
    family_id: "M06",
    name: "首领协作战｜四阶段首领",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1800],
    composition: [{ base: "SEALED_CHOICE", build: () => ({ reveal_visibility: "AGGREGATE_ONLY" }) }],
    editable_params: {
      hp_per_player: { type: "int", description: "首领生命 = 玩家数 × 该值", default: 6 },
      rounds: { type: "int", description: "轮数", default: 4 },
      boss_shield: { type: "int", description: "首领初始护盾", default: 4 },
      attack_value: { type: "int", description: "玩家攻击伤害", default: 2 },
      break_value: { type: "int", description: "破盾减少护盾", default: 2 },
      support_value: { type: "int", description: "支援恢复的生命", default: 2 },
      boss_damage: { type: "int", description: "首领每轮范围伤害", default: 2 },
    },
    locked_rules: [
      "首领不能由主持人临场控制",
      "失败有正式出口",
      "阶段变化只读取生命阈值",
    ],
    legal_actions: [
      {
        key: "new_game",
        description: "初始化首领生命、护盾与轮次",
        run(state, instance, ctx) {
          const p = instance.params;
          return event({ ...state, mechanism: { ...state.mechanism, bossHp: Object.keys(state.players).length * Number(p.hp_per_player), bossShield: Number(p.boss_shield), round: 0 } }, { mechanism: "M06-6", action: "new_game" });
        },
      },
      {
        key: "submit",
        description: "选择攻击、防御、支援或破盾（防代打：仅本人可见）",
        run(state, instance, ctx) {
          const player = String(ctx.player ?? "");
          const action = String(ctx.action ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "submit unknown player", { player });
          if (!["attack", "defend", "support", "break"].includes(action)) fail("MECH_ACTION_INVALID", "action must be attack/defend/support/break", { action });
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          return runBaseFlow("SEALED_CHOICE", "submit", state, instance.baseParams.SEALED_CHOICE, { sealedKey: `round-${round}`, player, value: { action } });
        },
      },
      {
        key: "resolve_round",
        description: "结算玩家行动与首领范围伤害",
        run(state, instance, ctx) {
          const p = instance.params;
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          const key = `round-${round}`;
          const subs = state.sealedSubmissions[key] || {};
          let bossHp = Number(state.mechanism.bossHp ?? 0);
          let bossShield = Number(state.mechanism.bossShield ?? 0);
          let players = { ...state.players };
          for (const [pl, sub] of Object.entries(subs)) {
            if (sub.action === "attack") {
              if (bossShield > 0) bossShield = Math.max(0, bossShield - Number(p.attack_value));
              else bossHp = Math.max(0, bossHp - Number(p.attack_value));
            } else if (sub.action === "break") {
              bossShield = Math.max(0, bossShield - Number(p.break_value));
            } else if (sub.action === "support") {
              players[pl] = { ...players[pl], durability: Math.min(players[pl].maxDurability, players[pl].durability + Number(p.support_value)) };
            }
          }
          for (const pl of Object.keys(players)) {
            let dmg = Number(p.boss_damage);
            if ((subs[pl] || {}).action === "defend") dmg = Math.max(0, dmg - 1);
            players = { ...players, [pl]: { ...players[pl], durability: Math.max(0, players[pl].durability - dmg) } };
          }
          const s = runBaseFlow("SEALED_CHOICE", "reveal", { ...state, players }, instance.baseParams.SEALED_CHOICE, { sealedKey: key });
          return event({ ...s, mechanism: { ...s.mechanism, round: round + 1, bossHp, bossShield } }, { mechanism: "M06-6", action: "resolve_round", round, bossHp, bossShield });
        },
      },
    ],
    output_fields: ["首领剩余生命", "首领护盾", "结果档位"],
    settle(state, instance, ctx) {
      const bossHp = Number(state.mechanism.bossHp ?? 0);
      const maxHp = Object.keys(state.players).length * Number(instance.params.hp_per_player);
      let tier;
      if (bossHp <= 0) tier = "A";
      else {
        const ratio = bossHp / maxHp;
        if (ratio <= 0.5) tier = "B";
        else if (ratio <= 0.75) tier = "C";
        else tier = "D";
      }
      const result = { status: "SETTLED", bossHp, bossShield: state.mechanism.bossShield ?? 0, tier };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M06-6", phase: "settled", result });
    },
  }),

  "M06-7": Object.freeze({
    template_id: "M06-7",
    family_id: "M06",
    name: "控制区域对抗｜三域争夺",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1500],
    composition: [{ base: "SEALED_CHOICE", build: () => ({ reveal_visibility: "AGGREGATE_ONLY" }) }],
    editable_params: {
      areas: { type: "list", description: "区域列表，每项 { id, points }", default: [] },
      force: { type: "int", description: "每人每轮可分配的力量", default: 3 },
      rounds: { type: "int", description: "轮数", default: 4 },
    },
    locked_rules: [
      "区域数量不超过5",
      "所有人提交后统一公开",
      "平手区域无人得分并累积到下轮",
    ],
    legal_actions: [
      {
        key: "submit",
        description: "秘密把力量分配到各区域",
        run(state, instance, ctx) {
          const p = instance.params;
          const player = String(ctx.player ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "submit unknown player", { player });
          const alloc = ctx.alloc || {};
          let total = 0;
          for (const [aid, raw] of Object.entries(alloc)) {
            if (!(p.areas || []).some((a) => a.id === aid)) fail("MECH_ACTION_INVALID", "Unknown area", { area: aid });
            const n = Math.trunc(Number(raw) || 0);
            if (n < 0) fail("MECH_ACTION_INVALID", "Negative force", { area: aid });
            total += n;
          }
          if (total > Number(p.force)) fail("MECH_ACTION_INVALID", "Force exceeded", { total, cap: p.force });
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          return runBaseFlow("SEALED_CHOICE", "submit", state, instance.baseParams.SEALED_CHOICE, { sealedKey: `round-${round}`, player, value: { alloc } });
        },
      },
      {
        key: "resolve_round",
        description: "各区域最高力量者得分；平手累积到下轮",
        run(state, instance, ctx) {
          const p = instance.params;
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          const key = `round-${round}`;
          const subs = state.sealedSubmissions[key] || {};
          const holdover = state.mechanism.holdover || {};
          const nextHoldover = {};
          let players = { ...state.players };
          for (const area of p.areas || []) {
            const totals = {};
            for (const pl of Object.keys(players)) {
              const v = Number((subs[pl]?.alloc || {})[area.id] || 0);
              if (v > 0) totals[pl] = v;
            }
            const entries = Object.entries(totals);
            if (entries.length === 0) continue;
            entries.sort((a, b) => b[1] - a[1]);
            const top = entries[0][1];
            const leaders = entries.filter((e) => e[1] === top).map((e) => e[0]);
            const stake = Number(area.points) + Number(holdover[area.id] || 0);
            if (leaders.length === 1) {
              players[leaders[0]] = { ...players[leaders[0]], score: players[leaders[0]].score + stake };
            } else {
              nextHoldover[area.id] = stake;
            }
          }
          const s = runBaseFlow("SEALED_CHOICE", "reveal", { ...state, players }, instance.baseParams.SEALED_CHOICE, { sealedKey: key });
          return event({ ...s, mechanism: { ...s.mechanism, round: round + 1, holdover: nextHoldover } }, { mechanism: "M06-7", action: "resolve_round", round });
        },
      },
    ],
    output_fields: ["区域分", "区域归属"],
    settle(state, instance, ctx) {
      const rank = Object.keys(state.players).map((pl) => ({ player: pl, score: state.players[pl].score })).sort((a, b) => b.score - a.score);
      const result = { status: "SETTLED", rank };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M06-7", phase: "settled", result });
    },
  }),

  "M06-8": Object.freeze({
    template_id: "M06-8",
    family_id: "M06",
    name: "非淘汰式对抗｜优势赛道",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [1500],
    composition: [{ base: "SEALED_CHOICE", build: () => ({ reveal_visibility: "PER_PLAYER" }) }],
    editable_params: {
      track_length: { type: "int", description: "赛道目标优势值", default: 12 },
      rounds: { type: "int", description: "轮数", default: 6 },
      advance: { type: "int", description: "推进获得的优势", default: 2 },
      block: { type: "int", description: "阻拦目标的优势削减", default: 1 },
      charge_advance: { type: "int", description: "蓄势后下轮推进优势", default: 4 },
      actions: { type: "list", description: "可选行动", default: ["advance", "block", "charge", "clear"] },
    },
    locked_rules: [
      "优势不低于0",
      "无人提前退出",
      "后半程必须保留追赶空间",
    ],
    legal_actions: [
      {
        key: "submit",
        description: "选择推进、阻拦目标、蓄势或清除负面",
        run(state, instance, ctx) {
          const p = instance.params;
          const player = String(ctx.player ?? "");
          const action = String(ctx.action ?? "");
          const target = String(ctx.target ?? "");
          if (!state.players[player]) fail("MECH_TARGET_UNKNOWN", "submit unknown player", { player });
          if (!p.actions.includes(action)) fail("MECH_ACTION_INVALID", "Unknown action", { action });
          if (action === "block" && (!state.players[target] || target === player)) fail("MECH_ACTION_INVALID", "block requires valid distinct target", { target });
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          return runBaseFlow("SEALED_CHOICE", "submit", state, instance.baseParams.SEALED_CHOICE, { sealedKey: `round-${round}`, player, value: { action, target } });
        },
      },
      {
        key: "resolve_round",
        description: "结算推进、阻拦、蓄势与清除",
        run(state, instance, ctx) {
          const p = instance.params;
          const round = Number(ctx.round ?? state.mechanism.round ?? 0);
          const key = `round-${round}`;
          const subs = state.sealedSubmissions[key] || {};
          const charged = { ...(state.mechanism.charged || {}) };
          const nextCharged = {};
          const leader = Object.keys(state.players).reduce((a, b) => (state.players[a].score >= state.players[b].score ? a : b));
          let players = { ...state.players };
          const blocks = {};
          for (const [pl, sub] of Object.entries(subs)) {
            if (sub.action === "block") blocks[String(sub.target || "")] = (blocks[String(sub.target || "")] || 0) + 1;
            else if (sub.action === "charge") nextCharged[pl] = true;
          }
          for (const [pl, sub] of Object.entries(subs)) {
            let gain = 0;
            if (sub.action === "advance") gain = charged[pl] ? Number(p.charge_advance) : Number(p.advance);
            players[pl] = { ...players[pl], score: Math.max(0, players[pl].score + gain) };
          }
          for (const [t, n] of Object.entries(blocks)) {
            if (t === leader) continue;
            players[t] = { ...players[t], score: Math.max(0, players[t].score - Number(p.block) * n) };
          }
          const s = runBaseFlow("SEALED_CHOICE", "reveal", { ...state, players }, instance.baseParams.SEALED_CHOICE, { sealedKey: key });
          return event({ ...s, mechanism: { ...s.mechanism, round: round + 1, charged: nextCharged } }, { mechanism: "M06-8", action: "resolve_round", round });
        },
      },
    ],
    output_fields: ["优势", "行动多样性"],
    settle(state, instance, ctx) {
      const rank = Object.keys(state.players).map((pl) => ({ player: pl, advantage: state.players[pl].score })).sort((a, b) => b.advantage - a.advantage);
      const result = { status: "SETTLED", rank, winner: rank[0]?.player };
      const next = { ...state, mechanism: { ...state.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M06-8", phase: "settled", result });
    },
  }),

  "M09-1": Object.freeze({
    template_id: "M09-1",
    family_id: "M09",
    name: "简单多数决｜单选多数",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [120],
    composition: [
      {
        base: "VOTE",
        build: (p) => ({
          ballot_mode: "SINGLE",
          candidates: p.candidates,
          allow_abstain: true,
          allow_revise: true,
        }),
      },
      {
        base: "TIMER",
        build: (p) => ({
          base_duration: p.submit_seconds,
          extend_on_action: false,
          extend_to: 15,
          timeout_code: "TIMEOUT",
        }),
      },
    ],
    editable_params: {
      candidates: { type: "list", description: "候选 ID（2—5 个）", default: ["A", "B", "C"] },
      submit_seconds: { type: "int", description: "提交时长（秒）", default: 120 },
      tie_exit: {
        type: "enum",
        description: "平票出口：REVOTE=二轮复投、KEEP_ALL=全部保留",
        default: "REVOTE",
      },
    },
    locked_rules: [
      "多数票只能形成集体决定，不能改变客观事实",
      "未提交视为弃权；有效票为 0 时输出 NO_DECISION",
    ],
    legal_actions: [
      {
        key: "vote",
        description: "投/改单选票（截止前可修改）",
        run(state, instance, ctx) {
          return runBaseFlow("VOTE", "cast", state, instance.baseParams.VOTE, {
            ballotKey: ctx.ballotKey ?? "main",
            player: ctx.player,
            value: ctx.abstain ? { abstain: true } : { choice: ctx.choice },
          });
        },
      },
    ],
    output_fields: ["结果", "票数分布"],
    settle(state, instance, ctx) {
      const key = ctx.ballotKey ?? "main";
      let s = state.ballotLocked[key]
        ? state
        : runBaseFlow("VOTE", "lock", state, instance.baseParams.VOTE, { ballotKey: key });
      const tally = tallyPlurality(s.ballots[key] || {}, instance.params.candidates);
      let result;
      if (tally.status === "NO_DECISION") {
        result = { status: "NO_DECISION", counts: tally.counts, abstain: tally.abstain };
      } else if (tally.status === "TIE") {
        result = {
          status: "TIE",
          tied: tally.tied,
          tieExit: instance.params.tie_exit,
          counts: tally.counts,
          abstain: tally.abstain,
        };
      } else {
        result = {
          status: "DECIDED",
          winner: tally.winner,
          counts: tally.counts,
          abstain: tally.abstain,
          valid: tally.valid,
        };
      }
      const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M09-1", phase: "settled", result });
    },
  }),

  "M09-2": Object.freeze({
    template_id: "M09-2",
    family_id: "M09",
    name: "门槛表决｜提案通过",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [120],
    composition: [
      {
        base: "VOTE",
        build: () => ({
          ballot_mode: "THRESHOLD",
          candidates: ["aye", "nay", "abstain"],
          allow_abstain: true,
          allow_revise: true,
        }),
      },
      {
        base: "TIMER",
        build: (p) => ({
          base_duration: p.submit_seconds,
          extend_on_action: false,
          extend_to: 15,
          timeout_code: "TIMEOUT",
        }),
      },
    ],
    editable_params: {
      threshold_ratio: { type: "number", description: "通过门槛比例（默认 2/3）", default: 2 / 3 },
      abstain_in_denominator: {
        type: "bool",
        description: "弃权是否计入分母",
        default: false,
      },
      submit_seconds: { type: "int", description: "提交时长（秒）", default: 120 },
      public_ballots: { type: "bool", description: "是否公开逐票（主持投影用）", default: false },
    },
    locked_rules: ["掉线玩家按弃权", "人数变化实时重算门槛但锁票后不再变化"],
    legal_actions: [
      {
        key: "vote",
        description: "赞成/反对/弃权",
        run(state, instance, ctx) {
          return runBaseFlow("VOTE", "cast", state, instance.baseParams.VOTE, {
            ballotKey: ctx.ballotKey ?? "main",
            player: ctx.player,
            value: { choice: ctx.choice },
          });
        },
      },
    ],
    output_fields: ["结果", "票数", "门槛"],
    settle(state, instance, ctx) {
      const key = ctx.ballotKey ?? "main";
      let s = state.ballotLocked[key]
        ? state
        : runBaseFlow("VOTE", "lock", state, instance.baseParams.VOTE, { ballotKey: key });
      // 未提交玩家按弃权补齐（掉线/超时）
      const ballots = { ...(s.ballots[key] || {}) };
      for (const player of Object.keys(s.players)) {
        if (!ballots[player]) ballots[player] = { choice: "abstain" };
      }
      const tally = tallyThreshold(ballots, {
        threshold_ratio: instance.params.threshold_ratio,
        abstain_in_denominator: instance.params.abstain_in_denominator,
      });
      const result = {
        status: tally.passed ? "PASSED" : "FAILED",
        aye: tally.aye,
        nay: tally.nay,
        abstain: tally.abstain,
        threshold: tally.threshold,
        denominator: tally.denominator,
        publicBallots: instance.params.public_ballots,
      };
      const next = { ...s, ballots: { ...s.ballots, [key]: ballots }, mechanism: { ...s.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M09-2", phase: "settled", result });
    },
  }),

  "M09-3": Object.freeze({
    template_id: "M09-3",
    family_id: "M09",
    name: "排序投票｜偏好排序",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [300],
    composition: [
      {
        base: "VOTE",
        build: (p) => ({
          ballot_mode: "RANKING",
          candidates: p.candidates,
          allow_abstain: true,
          allow_revise: true,
        }),
      },
    ],
    editable_params: {
      candidates: { type: "list", description: "候选（3—6 个）", default: ["A", "B", "C", "D"] },
      allow_partial: { type: "bool", description: "是否允许不完整排序", default: true },
    },
    locked_rules: [
      "计票算法必须由程序执行并提供可审计轮次",
      "未排序候选视为同等末位",
    ],
    legal_actions: [
      {
        key: "vote",
        description: "提交偏好排序",
        run(state, instance, ctx) {
          const ranking = Array.isArray(ctx.ranking) ? ctx.ranking : [];
          if (!instance.params.allow_partial) {
            const need = instance.params.candidates.length;
            if (ranking.length !== need) {
              fail("MECH_ACTION_INVALID", "Partial ranking locked", { got: ranking.length, need });
            }
          }
          return runBaseFlow("VOTE", "cast", state, instance.baseParams.VOTE, {
            ballotKey: ctx.ballotKey ?? "main",
            player: ctx.player,
            value: { ranking },
          });
        },
      },
    ],
    output_fields: ["胜者", "逐轮票数"],
    settle(state, instance, ctx) {
      const key = ctx.ballotKey ?? "main";
      let s = state.ballotLocked[key]
        ? state
        : runBaseFlow("VOTE", "lock", state, instance.baseParams.VOTE, { ballotKey: key });
      const tally = tallyIrv(s.ballots[key] || {}, instance.params.candidates);
      const result =
        tally.status === "DECIDED"
          ? { status: "DECIDED", winner: tally.winner, rounds: tally.rounds }
          : tally.status === "TIE_REVOTE"
            ? { status: "TIE_REVOTE", tied: tally.tied, rounds: tally.rounds }
            : { status: "NO_DECISION", rounds: tally.rounds };
      const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M09-3", phase: "settled", result });
    },
  }),

  "M09-4": Object.freeze({
    template_id: "M09-4",
    family_id: "M09",
    name: "多答案保留｜有限保留",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [120],
    composition: [
      {
        base: "VOTE",
        build: (p) => ({
          ballot_mode: "APPROVAL",
          candidates: p.candidates,
          allow_abstain: true,
          allow_revise: true,
          max_selections: p.max_selections,
        }),
      },
    ],
    editable_params: {
      candidates: { type: "list", description: "候选列表", default: ["A", "B", "C", "D", "E"] },
      max_selections: { type: "int", description: "每人最多勾选数", default: 2 },
      retain_ratio: { type: "number", description: "保留阈值（有效票比例）", default: 0.4 },
      max_retain: { type: "int", description: "最多保留项数", default: 3 },
    },
    locked_rules: ["不得无限勾选", "保留并不等于客观正确"],
    legal_actions: [
      {
        key: "vote",
        description: "勾选并提交候选",
        run(state, instance, ctx) {
          return runBaseFlow("VOTE", "cast", state, instance.baseParams.VOTE, {
            ballotKey: ctx.ballotKey ?? "main",
            player: ctx.player,
            value: { selections: ctx.selections || [] },
          });
        },
      },
    ],
    output_fields: ["保留项", "票数"],
    settle(state, instance, ctx) {
      const key = ctx.ballotKey ?? "main";
      let s = state.ballotLocked[key]
        ? state
        : runBaseFlow("VOTE", "lock", state, instance.baseParams.VOTE, { ballotKey: key });
      const tally = tallyMultiRetain(s.ballots[key] || {}, instance.params.candidates, {
        retain_ratio: instance.params.retain_ratio,
        max_retain: instance.params.max_retain,
      });
      const result = {
        status: tally.status,
        retained: tally.retained,
        tied: tally.tied || [],
        counts: tally.counts,
        threshold: tally.threshold,
        validBallots: tally.validBallots,
      };
      const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M09-4", phase: "settled", result });
    },
  }),

  "M09-5": Object.freeze({
    template_id: "M09-5",
    family_id: "M09",
    name: "带权票｜票权投入",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [120],
    composition: [
      {
        base: "VOTE",
        build: (p) => ({
          ballot_mode: "WEIGHTED",
          candidates: p.candidates,
          allow_abstain: true,
          allow_revise: true,
          max_weight_per_player: p.vote_power,
        }),
      },
    ],
    editable_params: {
      candidates: { type: "list", description: "候选列表", default: ["A", "B", "C"] },
      vote_power: { type: "int", description: "每人票权额度", default: 3 },
      clear_unused: {
        type: "bool",
        description: "阶段末是否清空未投入票权",
        default: true,
      },
    },
    locked_rules: ["票权来源必须是公开规则状态，不能由主持人临时授予"],
    legal_actions: [
      {
        key: "setup",
        description: "按规则发放票权（开局一次）",
        run(state, instance, ctx) {
          return runBaseFlow("VOTE", "grant_power", state, instance.baseParams.VOTE, {
            players: Object.keys(state.players),
            amounts: ctx.amounts,
          });
        },
      },
      {
        key: "vote",
        description: "投入/拆分票权",
        run(state, instance, ctx) {
          return runBaseFlow("VOTE", "cast", state, instance.baseParams.VOTE, {
            ballotKey: ctx.ballotKey ?? "main",
            player: ctx.player,
            value: { allocations: ctx.allocations || {} },
          });
        },
      },
    ],
    output_fields: ["结果", "票权分布"],
    settle(state, instance, ctx) {
      const key = ctx.ballotKey ?? "main";
      let s = state.ballotLocked[key]
        ? state
        : runBaseFlow("VOTE", "lock", state, instance.baseParams.VOTE, { ballotKey: key });
      const tally = tallyWeighted(s.ballots[key] || {}, instance.params.candidates);
      let votePower = s.votePower;
      if (instance.params.clear_unused) {
        votePower = Object.fromEntries(Object.keys(s.players).map((p) => [p, 0]));
      }
      const result =
        tally.status === "DECIDED"
          ? { status: "DECIDED", winner: tally.winner, counts: tally.counts }
          : tally.status === "TIE"
            ? { status: "TIE", tied: tally.tied, counts: tally.counts }
            : { status: "NO_DECISION", counts: tally.counts };
      const next = {
        ...s,
        votePower,
        mechanism: { ...s.mechanism, phase: "settled", result },
      };
      return event(next, { mechanism: "M09-5", phase: "settled", result });
    },
  }),

  "M09-6": Object.freeze({
    template_id: "M09-6",
    family_id: "M09",
    name: "否决权表决｜一次否决",
    nature: "PURE_GAME",
    participation_mode: "ALL",
    player_count: { min: 4, max: 9 },
    duration_presets: [165],
    composition: [
      {
        base: "VOTE",
        build: (p) => ({
          ballot_mode: "SINGLE",
          candidates: p.candidates,
          allow_abstain: true,
          allow_revise: true,
        }),
      },
      {
        base: "TIMER",
        build: (p) => ({
          base_duration: p.veto_window_seconds,
          extend_on_action: false,
          extend_to: 15,
          timeout_code: "TIMEOUT",
        }),
      },
    ],
    editable_params: {
      candidates: { type: "list", description: "候选列表", default: ["A", "B"] },
      veto_holders: {
        type: "object",
        description: "否决权持有：playerId -> 枚数（开局锁定，全场 1—2 枚）",
        default: {},
      },
      veto_window_seconds: { type: "int", description: "否决窗时长（秒）", default: 45 },
      fallback_branch: {
        type: "str",
        description: "否决后进入的预设替代分支 ID",
        default: "fallback",
      },
    },
    locked_rules: [
      "否决必须有成本和次数上限",
      "否决送入预设替代分支，不自动让相反选项获胜",
      "不得代按；持有者掉线默认不使用",
    ],
    legal_actions: [
      {
        key: "setup",
        description: "按开局规则发放否决权",
        run(state, instance, ctx) {
          const amounts = ctx.amounts || instance.params.veto_holders || {};
          return runBaseFlow("VOTE", "grant_veto", state, instance.baseParams.VOTE, { amounts });
        },
      },
      {
        key: "vote",
        description: "普通表决投票",
        run(state, instance, ctx) {
          return runBaseFlow("VOTE", "cast", state, instance.baseParams.VOTE, {
            ballotKey: ctx.ballotKey ?? "main",
            player: ctx.player,
            value: ctx.abstain ? { abstain: true } : { choice: ctx.choice },
          });
        },
      },
      {
        key: "open_veto_window",
        description: "普通表决结束后开启否决窗",
        run(state, instance, ctx) {
          const key = ctx.ballotKey ?? "main";
          let s = state.ballotLocked[key]
            ? state
            : runBaseFlow("VOTE", "lock", state, instance.baseParams.VOTE, { ballotKey: key });
          const tally = tallyPlurality(s.ballots[key] || {}, instance.params.candidates);
          s = runBaseFlow("TIMER", "start", s, instance.baseParams.TIMER, {
            clockKey: "veto",
            duration: instance.params.veto_window_seconds,
          });
          return {
            ...s,
            mechanism: {
              ...s.mechanism,
              phase: "veto_window",
              pendingResult: tally,
            },
          };
        },
      },
      {
        key: "veto",
        description: "行使否决权（第一枚生效）",
        run(state, instance, ctx) {
          if (state.mechanism.phase !== "veto_window") {
            fail("MECH_ACTION_INVALID", "Veto only during veto window", {
              phase: state.mechanism.phase,
            });
          }
          return runBaseFlow("VOTE", "cast_veto", state, instance.baseParams.VOTE, {
            ballotKey: ctx.ballotKey ?? "main",
            player: ctx.player,
          });
        },
      },
    ],
    output_fields: ["结果", "否决权消耗"],
    settle(state, instance, ctx) {
      const key = ctx.ballotKey ?? "main";
      let s = state;
      if (s.mechanism.phase === "open" || !s.ballotLocked[key]) {
        s = runBaseFlow("VOTE", "lock", s, instance.baseParams.VOTE, { ballotKey: key });
      }
      const pending =
        s.mechanism.pendingResult ||
        tallyPlurality(s.ballots[key] || {}, instance.params.candidates);
      let result;
      if (s.vetoCast) {
        result = {
          status: "VETOED",
          vetoBy: s.vetoCast.player,
          fallbackBranch: instance.params.fallback_branch,
          original: pending,
        };
      } else if (pending.status === "DECIDED") {
        result = { status: "DECIDED", winner: pending.winner, counts: pending.counts };
      } else if (pending.status === "TIE") {
        result = { status: "TIE", tied: pending.tied, counts: pending.counts };
      } else {
        result = { status: "NO_DECISION", counts: pending.counts };
      }
      const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M09-6", phase: "settled", result });
    },
  }),

  "M09-7": Object.freeze({
    template_id: "M09-7",
    family_id: "M09",
    name: "分组表决｜双层议决",
    nature: "PURE_GAME",
    participation_mode: "TEAM_BY_RULE",
    player_count: { min: 4, max: 9 },
    duration_presets: [180],
    composition: [
      {
        base: "VOTE",
        build: (p) => ({
          ballot_mode: "SINGLE",
          candidates: p.candidates,
          allow_abstain: true,
          allow_revise: true,
        }),
      },
    ],
    editable_params: {
      candidates: { type: "list", description: "候选列表", default: ["A", "B"] },
      groups: {
        type: "object",
        description: "公开分组：groupId -> playerId[]",
        default: { G1: ["A", "B"], G2: ["C", "D"] },
      },
      aggregate_mode: {
        type: "enum",
        description: "组票聚合：majority=组票多数、unanimous=组票一致",
        default: "majority",
      },
    },
    locked_rules: [
      "分组必须来自既有公开结构，不为制造复杂度临时分配",
      "组内平票按该组弃权；单人组的个人票即组票；无人组不计分母",
    ],
    legal_actions: [
      {
        key: "vote",
        description: "组内投票（个人票）",
        run(state, instance, ctx) {
          return runBaseFlow("VOTE", "cast", state, instance.baseParams.VOTE, {
            ballotKey: ctx.ballotKey ?? "main",
            player: ctx.player,
            value: ctx.abstain ? { abstain: true } : { choice: ctx.choice },
          });
        },
      },
    ],
    output_fields: ["个人票", "组内结果", "总结果"],
    settle(state, instance, ctx) {
      const key = ctx.ballotKey ?? "main";
      let s = state.ballotLocked[key]
        ? state
        : runBaseFlow("VOTE", "lock", state, instance.baseParams.VOTE, { ballotKey: key });
      const personal = s.ballots[key] || {};
      const tally = tallyGroupLayers(personal, instance.params.groups, {
        candidates: instance.params.candidates,
        aggregate_mode: instance.params.aggregate_mode,
      });
      const result = {
        status: tally.status,
        winner: tally.winner || null,
        tied: tally.tied || [],
        personal,
        groupResults: tally.groupResults,
        groupVotes: tally.groupVotes,
        counts: tally.counts,
      };
      const next = { ...s, mechanism: { ...s.mechanism, phase: "settled", result } };
      return event(next, { mechanism: "M09-7", phase: "settled", result });
    },
  }),
});

/** M04-3 反集中：当前轮该玩家是否被某攻击者克制（用于消费补偿护盾）。 */
function wasCountered(subs, player) {
  const myStance = subs[player]?.stance;
  if (!myStance) return false;
  for (const sub of Object.values(subs)) {
    if (String(sub.target) !== player) continue;
    if (STANCE_BEATS[String(sub.stance)] === myStance) return true;
  }
  return false;
}

/** 实例化一个机制：合并 editable_params 默认值，并把每个 base 的参数按 composition.build 解析出来。 */
export function instantiateMechanism(templateId, params = {}) {
  const tpl = MECHANISM_TEMPLATES[String(templateId ?? "")];
  if (!tpl) fail("MECH_UNKNOWN", `Unknown mechanism template ${templateId}`, { templateId });
  const merged = {};
  for (const [key, spec] of Object.entries(tpl.editable_params)) {
    merged[key] = params[key] !== undefined ? params[key] : spec.default;
  }
  const baseParams = {};
  for (const c of tpl.composition) {
    baseParams[c.base] = c.build(merged);
  }
  return { template: tpl.template_id, params: merged, baseParams: Object.freeze(baseParams) };
}

/** 执行一次玩家合法操作。自定义 action（带 run）走家族逻辑，其余委托给 base 流程。 */
export function runMechanismAction(templateId, actionKey, state, instance, ctx = {}) {
  const tpl = MECHANISM_TEMPLATES[String(templateId ?? "")];
  if (!tpl) fail("MECH_UNKNOWN", `Unknown mechanism template ${templateId}`, { templateId });
  const action = tpl.legal_actions.find((a) => a.key === actionKey);
  if (!action) fail("MECH_ACTION_UNKNOWN", `Unknown action ${actionKey} on ${templateId}`, { actionKey });
  if (action.run) return action.run(state, instance, ctx);
  const baseParams = instance.baseParams[action.base];
  return runBaseFlow(action.base, action.flow, state, baseParams, ctx);
}

/** 结算一个机制，返回新状态并把 result 写入 state.mechanism.result。 */
export function settleMechanism(templateId, state, instance, ctx = {}) {
  const tpl = MECHANISM_TEMPLATES[String(templateId ?? "")];
  if (!tpl) fail("MECH_UNKNOWN", `Unknown mechanism template ${templateId}`, { templateId });
  return tpl.settle(state, instance, ctx);
}

/** 文档化：全部机制的 schema 摘要，供工作台/提示词使用。 */
export function listMechanismDocuments() {
  return Object.values(MECHANISM_TEMPLATES).map((t) => ({
    template_id: t.template_id,
    family_id: t.family_id,
    name: t.name,
    nature: t.nature,
    legal_actions: t.legal_actions.map((a) => a.key),
    editable_params: Object.fromEntries(
      Object.entries(t.editable_params).map(([k, s]) => [k, s.description]),
    ),
    locked_rules: t.locked_rules,
    output_fields: t.output_fields,
    composition: t.composition.map((c) => c.base),
  }));
}

export function describeMechanism(templateId) {
  return MECHANISM_TEMPLATES[String(templateId ?? "")] || null;
}