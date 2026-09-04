/**
 * 底层模板（基座模板层）
 *
 * 这是机制成品设计库 V2.0「成品模板」之下的一层可复用原语。
 * 设计目标：M01-M11 的每个成品机制，都能"有基座就复用、没有就单独写"。
 * 见设计库 M02/M03/M09 里反复出现的底层能力：
 *   转移 TRANSFER / 出价 BID / 时间窗 TIMER / 暗箱 SEALED_CHOICE / 表决 VOTE。
 *
 * 与原子效果库（mechanism-effects.js）的关系：
 *   - 效果库 = 最小不可再分的操作（DAMAGE/STEAL/BID/WITHDRAW…）
 *   - 底层模板 = 由效果 + 校验 + 额外脚手架状态组装出的可复用流程
 *   例如 TRANSFER.settle 复用 STEAL（原子转移 + 容量 + 不负数），不手写第二份。
 *
 * 与效果引擎相同的硬标准（不降低）：
 *   1. 纯函数、确定性：每个 flow 返回 { state, record }，不改传入的 state。
 *   2. 每个基座都声明：功能、editable_params（可调，含每个填入位置的含义）、
 *      locked_rules（复用语义锁死）、effect_refs（复用了哪些效果）。
 *   3. locked_rules 里能落成代码的，都在运行时强制校验（抛错），不做"文档式锁定"。
 */

import { applyEffect, createGameState } from "./mechanism-effects.js";

export class MechanismBaseTemplateError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "MechanismBaseTemplateError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function fail(code, message, details) {
  throw new MechanismBaseTemplateError(code, message, details);
}

const P = (type, description, def) => ({ type, description, default: def });

/**
 * 在效果引擎的状态之上，扩展出机制基座需要的高层脚手架状态。
 * （pending 交易单、出价可见性、计时器、密封提交）
 */
export function createMechanismState(config = {}) {
  return {
    ...createGameState(config),
    // 底层模板扩展区
    transfers: {}, // transferId -> { resource, amount, from, to, confirmedBy, status, timing }
    transferCounts: {}, // resource -> 已结算转移次数（供 transfer_limit 用）
    clocks: {}, // clockKey -> { remaining, deadline }
    sealedSubmissions: {}, // sealedKey -> { playerId -> value }
    sealedRevealed: {}, // sealedKey -> true（统一揭示后）
    // VOTE 基座
    ballots: {}, // ballotKey -> { playerId -> ballot }
    ballotLocked: {}, // ballotKey -> true
    votePower: {}, // playerId -> remaining（M09-5 票权）
    vetoTokens: {}, // playerId -> remaining（M09-6 否决权）
    vetoCast: null, // { player, ballotKey } 服务器确认的第一枚否决
    // 家族专用扩展区（M02/M03 剩余变体复用，不进入底层模板语义）
    offers: {}, // offerId -> { give_resource, give_amount, want_resource, want_amount, from, status }（M02-4 报价板）
    pools: {}, // poolKey -> { resource, total }（M02-2 公共库存 / M02-6 公共储备）
    talks: {}, // talkId -> { inviter, invitee, status, remaining }（M02-3 密谈房间）
    exchangeCounts: {}, // playerId -> 已兑换次数（M02-2）
    loans: {}, // loanId -> { resource, amount, from, to, status }（M02-5 借用合同）
    commitments: {}, // commitmentId -> { player, commitments, status }（M03-5 非货币竞价）
  };
}

const BALLOT_MODES = Object.freeze([
  "SINGLE",
  "THRESHOLD",
  "RANKING",
  "APPROVAL",
  "WEIGHTED",
]);

function asCandidateList(params) {
  return Array.isArray(params.candidates) ? params.candidates.map(String) : [];
}

function normalizeBallot(params, raw) {
  const mode = String(params.ballot_mode || "SINGLE");
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const candidates = asCandidateList(params);

  if (mode === "THRESHOLD") {
    const choice = String(value.choice ?? (value.abstain ? "abstain" : ""));
    if (!["aye", "nay", "abstain"].includes(choice)) {
      fail("BASE_INVALID_BALLOT", "THRESHOLD ballot must be aye/nay/abstain", { choice });
    }
    return { choice };
  }

  if (value.abstain === true) {
    if (!params.allow_abstain) {
      fail("BASE_RULE_VIOLATION", "Abstain is locked by template", { mode });
    }
    return { abstain: true };
  }

  if (mode === "SINGLE") {
    const choice = String(value.choice ?? "");
    if (!candidates.includes(choice)) {
      fail("BASE_INVALID_BALLOT", "SINGLE choice must be a known candidate", { choice, candidates });
    }
    return { choice };
  }

  if (mode === "APPROVAL") {
    const selections = Array.isArray(value.selections)
      ? [...new Set(value.selections.map(String))]
      : [];
    const maxSel = params.max_selections == null ? null : Math.trunc(Number(params.max_selections));
    if (maxSel != null && selections.length > maxSel) {
      fail("BASE_RULE_VIOLATION", "Too many selections", { count: selections.length, max: maxSel });
    }
    for (const id of selections) {
      if (!candidates.includes(id)) {
        fail("BASE_INVALID_BALLOT", "Unknown approval candidate", { id, candidates });
      }
    }
    return { selections };
  }

  if (mode === "RANKING") {
    const ranking = Array.isArray(value.ranking) ? value.ranking.map(String) : [];
    const seen = new Set();
    for (const id of ranking) {
      if (!candidates.includes(id)) {
        fail("BASE_INVALID_BALLOT", "Unknown ranking candidate", { id, candidates });
      }
      if (seen.has(id)) fail("BASE_INVALID_BALLOT", "Duplicate ranking entry", { id });
      seen.add(id);
    }
    return { ranking };
  }

  if (mode === "WEIGHTED") {
    const allocations = value.allocations && typeof value.allocations === "object" && !Array.isArray(value.allocations)
      ? value.allocations
      : {};
    let spent = 0;
    const out = {};
    for (const [id, amountRaw] of Object.entries(allocations)) {
      if (!candidates.includes(String(id))) {
        fail("BASE_INVALID_BALLOT", "Unknown weighted candidate", { id, candidates });
      }
      const amount = Math.trunc(Number(amountRaw) || 0);
      if (amount < 0) fail("BASE_INVALID_BALLOT", "Weighted allocation cannot be negative", { id, amount });
      if (amount > 0) {
        out[id] = amount;
        spent += amount;
      }
    }
    return { allocations: out, spent };
  }

  fail("BASE_INVALID_PARAMS", `Unknown ballot_mode ${mode}`, { mode });
}

/** 多数/相对多数：最高票胜；平票返回 tied；有效票为 0 → NO_DECISION。 */
export function tallyPlurality(ballots = {}, candidates = []) {
  const counts = Object.fromEntries(candidates.map((c) => [String(c), 0]));
  let valid = 0;
  let abstain = 0;
  for (const ballot of Object.values(ballots)) {
    if (!ballot || ballot.abstain) {
      abstain += 1;
      continue;
    }
    const choice = String(ballot.choice ?? "");
    if (!(choice in counts)) continue;
    counts[choice] += 1;
    valid += 1;
  }
  if (valid === 0) {
    return { status: "NO_DECISION", winner: null, tied: [], counts, valid, abstain };
  }
  let top = -1;
  for (const c of candidates) top = Math.max(top, counts[String(c)]);
  const tied = candidates.filter((c) => counts[String(c)] === top).map(String);
  if (tied.length !== 1) {
    return { status: "TIE", winner: null, tied, counts, valid, abstain };
  }
  return { status: "DECIDED", winner: tied[0], tied: [], counts, valid, abstain };
}

/**
 * 门槛表决：赞成达到 ceil(分母 * ratio) 则通过。
 * abstain_in_denominator=true 时弃权计入分母；否则分母=aye+nay。
 */
export function tallyThreshold(ballots = {}, params = {}) {
  const ratio = Number(params.threshold_ratio ?? 2 / 3);
  const abstainInDenom = Boolean(params.abstain_in_denominator);
  let aye = 0;
  let nay = 0;
  let abstain = 0;
  for (const ballot of Object.values(ballots)) {
    const choice = String(ballot?.choice ?? "abstain");
    if (choice === "aye") aye += 1;
    else if (choice === "nay") nay += 1;
    else abstain += 1;
  }
  const denominator = abstainInDenom ? aye + nay + abstain : aye + nay;
  const threshold = denominator === 0 ? 0 : Math.ceil(denominator * ratio);
  const passed = denominator > 0 && aye >= threshold;
  return {
    status: passed ? "PASSED" : "FAILED",
    aye,
    nay,
    abstain,
    denominator,
    threshold,
    passed,
  };
}

/** 即时决选（IRV）：淘汰末位并转移，直至过半；末位并列按设计进入 TIE_REVOTE。 */
export function tallyIrv(ballots = {}, candidates = []) {
  let remaining = candidates.map(String);
  const rounds = [];
  if (remaining.length === 0) {
    return { status: "NO_DECISION", winner: null, tied: [], rounds };
  }
  while (remaining.length > 1) {
    const counts = Object.fromEntries(remaining.map((c) => [c, 0]));
    let total = 0;
    for (const ballot of Object.values(ballots)) {
      if (!ballot || ballot.abstain) continue;
      const ranking = Array.isArray(ballot.ranking) ? ballot.ranking.map(String) : [];
      const pick = ranking.find((c) => remaining.includes(c));
      if (!pick) continue;
      counts[pick] += 1;
      total += 1;
    }
    rounds.push({ remaining: [...remaining], counts: { ...counts }, total });
    if (total === 0) {
      return { status: "NO_DECISION", winner: null, tied: remaining, rounds };
    }
    for (const c of remaining) {
      if (counts[c] > total / 2) {
        return { status: "DECIDED", winner: c, tied: [], rounds };
      }
    }
    let min = Infinity;
    for (const c of remaining) min = Math.min(min, counts[c]);
    const lowest = remaining.filter((c) => counts[c] === min);
    if (lowest.length === remaining.length) {
      return { status: "TIE_REVOTE", winner: null, tied: lowest, rounds };
    }
    if (lowest.length > 1) {
      if (rounds.length < 2) {
        return { status: "TIE_REVOTE", winner: null, tied: lowest, rounds };
      }
      const prev = rounds[rounds.length - 2].counts;
      let prevMin = Infinity;
      for (const c of lowest) prevMin = Math.min(prevMin, Number(prev[c] ?? 0));
      const eliminate = lowest.filter((c) => Number(prev[c] ?? 0) === prevMin);
      if (eliminate.length === lowest.length) {
        return { status: "TIE_REVOTE", winner: null, tied: lowest, rounds };
      }
      remaining = remaining.filter((c) => !eliminate.includes(c));
      continue;
    }
    remaining = remaining.filter((c) => c !== lowest[0]);
  }
  return {
    status: remaining[0] ? "DECIDED" : "NO_DECISION",
    winner: remaining[0] || null,
    tied: [],
    rounds,
  };
}

/** 多答案保留：达有效票阈值者保留，超上限按票截取；边界平票 → TIED_PENDING_RULE。 */
export function tallyMultiRetain(ballots = {}, candidates = [], params = {}) {
  const ratio = Number(params.retain_ratio ?? 0.4);
  const maxRetain = Math.max(1, Math.trunc(Number(params.max_retain ?? 3) || 1));
  const counts = Object.fromEntries(candidates.map((c) => [String(c), 0]));
  let validBallots = 0;
  for (const ballot of Object.values(ballots)) {
    if (!ballot || ballot.abstain) continue;
    const selections = Array.isArray(ballot.selections) ? ballot.selections.map(String) : [];
    if (selections.length === 0) continue;
    validBallots += 1;
    for (const id of selections) {
      if (id in counts) counts[id] += 1;
    }
  }
  if (validBallots === 0) {
    return { status: "NO_DECISION", retained: [], tied: [], counts, validBallots };
  }
  const threshold = Math.ceil(validBallots * ratio);
  const qualified = candidates
    .map(String)
    .filter((c) => counts[c] >= threshold)
    .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  if (qualified.length <= maxRetain) {
    return { status: "RETAINED", retained: qualified, tied: [], counts, validBallots, threshold };
  }
  const cutoff = counts[qualified[maxRetain - 1]];
  const clear = qualified.filter((c) => counts[c] > cutoff);
  const edge = qualified.filter((c) => counts[c] === cutoff);
  const slotsLeft = maxRetain - clear.length;
  if (edge.length > slotsLeft) {
    return {
      status: "TIED_PENDING_RULE",
      retained: clear,
      tied: edge,
      counts,
      validBallots,
      threshold,
    };
  }
  return {
    status: "RETAINED",
    retained: [...clear, ...edge.slice(0, slotsLeft)],
    tied: [],
    counts,
    validBallots,
    threshold,
  };
}

/** 带权票：按票权总量计；平票返回 TIE。 */
export function tallyWeighted(ballots = {}, candidates = []) {
  const counts = Object.fromEntries(candidates.map((c) => [String(c), 0]));
  let valid = 0;
  for (const ballot of Object.values(ballots)) {
    if (!ballot || ballot.abstain) continue;
    const allocations = ballot.allocations || {};
    let spent = 0;
    for (const [id, amount] of Object.entries(allocations)) {
      if (!(id in counts)) continue;
      const n = Math.trunc(Number(amount) || 0);
      counts[id] += n;
      spent += n;
    }
    if (spent > 0) valid += 1;
  }
  if (valid === 0) {
    return { status: "NO_DECISION", winner: null, tied: [], counts, valid };
  }
  let top = -1;
  for (const c of candidates) top = Math.max(top, counts[String(c)]);
  const tied = candidates.filter((c) => counts[String(c)] === top).map(String);
  if (tied.length !== 1) {
    return { status: "TIE", winner: null, tied, counts, valid };
  }
  return { status: "DECIDED", winner: tied[0], tied: [], counts, valid };
}

/**
 * 分组双层：组内简单多数成组票（组内平票=组弃权）；组票再按 majority 或 unanimous 聚合。
 */
export function tallyGroupLayers(ballots = {}, groups = {}, params = {}) {
  const aggregate = String(params.aggregate_mode || "majority");
  const candidates = asCandidateList({ candidates: params.candidates || [] });
  const groupResults = {};
  const groupVotes = [];
  for (const [groupId, members] of Object.entries(groups)) {
    const memberList = Array.isArray(members) ? members.map(String) : [];
    if (memberList.length === 0) continue;
    const subset = {};
    for (const player of memberList) {
      if (ballots[player] !== undefined) subset[player] = ballots[player];
    }
    const inner = tallyPlurality(subset, candidates);
    if (inner.status === "DECIDED") {
      groupResults[groupId] = { status: "DECIDED", choice: inner.winner, counts: inner.counts };
      groupVotes.push({ choice: inner.winner });
    } else if (inner.status === "TIE") {
      groupResults[groupId] = { status: "ABSTAIN", reason: "group_tie", tied: inner.tied };
    } else {
      groupResults[groupId] = { status: "ABSTAIN", reason: "no_decision" };
    }
  }
  if (groupVotes.length === 0) {
    return { status: "NO_DECISION", winner: null, groupResults, groupVotes };
  }
  if (aggregate === "unanimous") {
    const first = groupVotes[0].choice;
    const allSame = groupVotes.every((g) => g.choice === first);
    return {
      status: allSame ? "DECIDED" : "FAILED",
      winner: allSame ? first : null,
      groupResults,
      groupVotes,
    };
  }
  const outer = tallyPlurality(
    Object.fromEntries(groupVotes.map((g, i) => [`g${i}`, { choice: g.choice }])),
    candidates,
  );
  return {
    status: outer.status,
    winner: outer.winner,
    tied: outer.tied,
    groupResults,
    groupVotes,
    counts: outer.counts,
  };
}

export const MECHANISM_BASE_TEMPLATES = Object.freeze({
  TRANSFER: Object.freeze({
    code: "TRANSFER",
    description:
      "转移/成交基座：把一项有机制状态的资源从一方原子转移到另一方，支持确认模式与时序。",
    state_regions: ["players[].resources", "transfers", "transferCounts"],
    effect_refs: ["STEAL"],
    editable_params: {
      resource_types: P("list", "可交易资源种类（填入资源键列表，如 ['currency','evidence']）", ["currency"]),
      confirm_mode: P("enum", "确认模式：DOUBLE=双方确认，SINGLE=仅对方确认", "DOUBLE"),
      timing: P("enum", "履约时序：IMMEDIATE=接受即转移，STAGE_END=阶段末统一转移", "IMMEDIATE"),
      allow_gift: P("bool", "是否允许赠送（无对价转移）", true),
      per_player_parallel: P("int", "每人并行未成交交易单上限", 3),
      transfer_limit: P("int|null", "每种资源类型累计可转移次数上限；null=不限（‘一次传递’用 1）", null),
    },
    locked_rules: [
      "只登记 resource_types 内的资源，普通叙事信息不进入本系统",
      "必须原子转移：余额不足整单失败，不做部分扣除（由 STEAL 保证）",
      "DOUBLE 模式下单方确认无效",
      "已结算（settled）的立即转移不可撤回",
    ],
    flows: {
      propose(state, params, ctx) {
        const resource = String(ctx.resource ?? "");
        if (!params.resource_types.includes(resource)) {
          fail("BASE_RULE_VIOLATION", `TRANSFER rejects non-mechanism resource ${resource}`, {
            resource,
            allowed: params.resource_types,
          });
        }
        const from = String(ctx.from ?? "");
        const to = String(ctx.to ?? "");
        if (!state.players[from] || !state.players[to]) {
          fail("BASE_TARGET_UNKNOWN", "TRANSFER propose requires known from/to players", { from, to });
        }
        const pending = Object.values(state.transfers).filter((t) => t.from === from && t.status !== "settled");
        if (pending.length >= params.per_player_parallel) {
          fail("BASE_PARALLEL_LIMIT", "Parallel transfer offer limit reached", {
            from,
            limit: params.per_player_parallel,
          });
        }
        const id = String(ctx.transferId ?? `tx-${Object.keys(state.transfers).length + 1}`);
        if (state.transfers[id]) fail("BASE_DUPLICATE", `transferId ${id} already exists`, { id });
        const amount = Math.max(0, Math.trunc(Number(ctx.amount) || 0));
        const record = {
          resource,
          amount,
          from,
          to,
          confirmedBy: [],
          status: "proposed",
          timing: params.timing,
        };
        return {
          state: { ...state, transfers: { ...state.transfers, [id]: record } },
          record: { base: "TRANSFER", flow: "propose", id, resource, amount, from, to, timing: params.timing },
        };
      },
      confirm(state, params, ctx) {
        const id = String(ctx.transferId ?? "");
        const tx = state.transfers[id];
        if (!tx) fail("BASE_UNKNOWN", "TRANSFER confirm references unknown transferId", { id });
        if (tx.status === "settled") fail("BASE_ALREADY_SETTLED", "Transfer already settled", { id });
        const by = String(ctx.by ?? "");
        const required = params.confirm_mode === "DOUBLE" ? [tx.from, tx.to] : [tx.to];
        if (!required.includes(by)) {
          fail("BASE_INVALID_CONFIRMER", "Confirming party is not required by confirm_mode", {
            id,
            by,
            required,
          });
        }
        const confirmedBy = Array.from(new Set([...tx.confirmedBy, by]));
        const allConfirmed = required.every((p) => confirmedBy.includes(p));
        const nextTx = {
          ...tx,
          confirmedBy,
          status: allConfirmed ? "accepted" : "proposed",
        };
        const after = { ...state, transfers: { ...state.transfers, [id]: nextTx } };
        if (allConfirmed && params.timing === "IMMEDIATE") {
          return MECHANISM_BASE_TEMPLATES.TRANSFER.flows.settle(after, params, { ...ctx, transferId: id });
        }
        return {
          state: after,
          record: { base: "TRANSFER", flow: "confirm", id, by, status: nextTx.status },
        };
      },
      settle(state, params, ctx) {
        const id = String(ctx.transferId ?? "");
        const tx = state.transfers[id];
        if (!tx) fail("BASE_UNKNOWN", "TRANSFER settle references unknown transferId", { id });
        if (tx.status !== "accepted" && tx.status !== "proposed") {
          fail("BASE_NOT_ACCEPTED", "Transfer must be accepted before settling", { id, status: tx.status });
        }
        const limit = params.transfer_limit;
        if (limit !== null && limit !== undefined) {
          const done = Number(state.transferCounts[tx.resource] || 0);
          if (done >= limit) {
            fail("BASE_TRANSFER_LIMIT", "Resource transfer limit reached", {
              resource: tx.resource,
              limit,
              done,
            });
          }
        }
        // 复用原子效果 STEAL：原子转移 + 容量 + 不负数 + 余额不足整单失败
        const settledState = applyEffect(state, {
          code: "STEAL",
          from: tx.from,
          to: tx.to,
          resource: tx.resource,
          amount: tx.amount,
        });
        const nextTx = { ...settledState.transfers[id], confirmedBy: tx.confirmedBy, status: "settled" };
        const after = {
          ...settledState,
          transfers: { ...settledState.transfers, [id]: nextTx },
          transferCounts: {
            ...settledState.transferCounts,
            [tx.resource]: (Number(settledState.transferCounts[tx.resource] || 0)) + 1,
          },
        };
        return {
          state: after,
          record: { base: "TRANSFER", flow: "settle", id, resource: tx.resource, amount: tx.amount, from: tx.from, to: tx.to },
        };
      },
      revoke(state, params, ctx) {
        const id = String(ctx.transferId ?? "");
        const tx = state.transfers[id];
        if (!tx) fail("BASE_UNKNOWN", "TRANSFER revoke references unknown transferId", { id });
        if (tx.status === "settled") {
          fail("BASE_ALREADY_SETTLED", "Settled immediate transfer cannot be revoked", { id });
        }
        const transfers = { ...state.transfers };
        delete transfers[id];
        return {
          state: { ...state, transfers },
          record: { base: "TRANSFER", flow: "revoke", id },
        };
      },
    },
  }),

  BID: Object.freeze({
    code: "BID",
    description: "出价/竞争基座：冻结资源提交报价，支持叫价/降价/暗标三种规则与冻结解冻。",
    state_regions: ["players[].resources", "bids"],
    effect_refs: ["BID", "WITHDRAW"],
    editable_params: {
      bid_rule: P("enum", "出价规则：INCREMENT=叫价、DECREMENT=降价、SEALED=暗标", "INCREMENT"),
      visibility: P("enum", "报价可见性：PUBLIC=全可见、SEALED=没人看见、LEADER_ONLY=仅见领先", "PUBLIC"),
      min_increment: P("int", "最低加价幅度（叫价模式用）", 1),
      freeze_asset: P("str", "用哪种资源冻结作为出价保证", "currency"),
    },
    locked_rules: [
      "出价必须先冻结等额资源（由 BID 效果保证）",
      "成交或失败后才解冻/扣除，不允许中途透支",
      "未成交出价必须可撤回（WITHDRAW）",
      "SEALED 模式下结算前不可读取他人报价（投影层强制）",
    ],
    flows: {
      bid(state, params, ctx) {
        const next = applyEffect(state, {
          code: "BID",
          player: ctx.player,
          amount: ctx.amount,
          asset: params.freeze_asset,
          bid_id: ctx.bidId,
        });
        const bidId = String(ctx.bidId ?? `bid-${Object.keys(state.bids).length + 1}`);
        const bids = {
          ...next.bids,
          [bidId]: { ...next.bids[bidId], rule: params.bid_rule, visibility: params.visibility },
        };
        return {
          state: { ...next, bids },
          record: { base: "BID", flow: "bid", bidId, rule: params.bid_rule, visibility: params.visibility },
        };
      },
      withdraw(state, params, ctx) {
        const next = applyEffect(state, { code: "WITHDRAW", action_id: ctx.actionId });
        return {
          state: next,
          record: { base: "BID", flow: "withdraw", actionId: ctx.actionId },
        };
      },
    },
  }),

  TIMER: Object.freeze({
    code: "TIMER",
    description: "时间窗/倒计时基座：倒计时、补时、超时输出确定结算码。",
    state_regions: ["clocks"],
    effect_refs: [],
    editable_params: {
      base_duration: P("int", "基础时长（秒）", 480),
      extend_on_action: P("bool", "有效操作是否补时（明拍每次出价补至 extend_to）", false),
      extend_to: P("int", "补时目标剩余秒数", 15),
      timeout_code: P("enum", "超时输出的结算码（见设计库通用异常状态）", "TIMEOUT"),
    },
    locked_rules: [
      "超时必须给出确定的异常结算码，不允许主持人现编出口",
      "各阶段耗时对主持人与玩家都可见",
    ],
    flows: {
      start(state, params, ctx) {
        const key = String(ctx.clockKey ?? "main");
        if (state.clocks[key]) fail("BASE_DUPLICATE", `clock ${key} already exists`, { key });
        const duration = Math.max(0, Math.trunc(Number(ctx.duration ?? params.base_duration) || 0));
        return {
          state: { ...state, clocks: { ...state.clocks, [key]: { remaining: duration, deadline: null } } },
          record: { base: "TIMER", flow: "start", key, remaining: duration },
        };
      },
      tick(state, params, ctx) {
        const key = String(ctx.clockKey ?? "main");
        const clock = state.clocks[key];
        if (!clock) fail("BASE_UNKNOWN", "TIMER tick references unknown clockKey", { key });
        const seconds = Math.max(0, Math.trunc(Number(ctx.seconds) || 0));
        const remaining = Math.max(0, clock.remaining - seconds);
        const after = { ...state, clocks: { ...state.clocks, [key]: { ...clock, remaining } } };
        if (remaining <= 0) {
          return {
            state: after,
            record: { base: "TIMER", flow: "timeout", key, code: params.timeout_code, remaining },
          };
        }
        return { state: after, record: { base: "TIMER", flow: "tick", key, seconds, remaining } };
      },
      extend(state, params, ctx) {
        const key = String(ctx.clockKey ?? "main");
        const clock = state.clocks[key];
        if (!clock) fail("BASE_UNKNOWN", "TIMER extend references unknown clockKey", { key });
        const target = Math.max(1, Math.trunc(Number(params.extend_to) || 0));
        const remaining = params.extend_on_action ? target : clock.remaining;
        return {
          state: { ...state, clocks: { ...state.clocks, [key]: { ...clock, remaining } } },
          record: { base: "TIMER", flow: "extend", key, remaining },
        };
      },
    },
  }),

  SEALED_CHOICE: Object.freeze({
    code: "SEALED_CHOICE",
    description: "暗箱/同时提交基座：秘密提交 + 统一揭示，揭示前他人不可见。",
    state_regions: ["sealedSubmissions", "sealedRevealed"],
    effect_refs: ["REVEAL_PUBLIC", "REVEAL_PRIVATE"],
    editable_params: {
      reveal_visibility: P("enum", "揭示后的公开粒度：AGGREGATE_ONLY=仅公开汇总、PER_PLAYER=公开到个人", "AGGREGATE_ONLY"),
    },
    locked_rules: [
      "揭示前任何提交对其他玩家不可见",
      "揭示必须统一/原子，不允许提前偷看",
    ],
    flows: {
      submit(state, params, ctx) {
        const key = String(ctx.sealedKey ?? "");
        const player = String(ctx.player ?? "");
        if (!state.players[player]) fail("BASE_TARGET_UNKNOWN", "SEALED_CHOICE submit unknown player", { player });
        if (state.sealedRevealed[key]) fail("BASE_ALREADY_REVEALED", "Cannot submit after reveal", { key });
        const submissions = state.sealedSubmissions[key] || {};
        const next = {
          ...state,
          sealedSubmissions: { ...state.sealedSubmissions, [key]: { ...submissions, [player]: ctx.value } },
        };
        return {
          state: next,
          record: { base: "SEALED_CHOICE", flow: "submit", key, player, hasValue: true },
        };
      },
      reveal(state, params, ctx) {
        const key = String(ctx.sealedKey ?? "");
        if (!state.sealedSubmissions[key]) fail("BASE_UNKNOWN", "SEALED_CHOICE reveal unknown sealedKey", { key });
        if (state.sealedRevealed[key]) fail("BASE_ALREADY_REVEALED", "Already revealed", { key });
        return {
          state: { ...state, sealedRevealed: { ...state.sealedRevealed, [key]: true } },
          record: {
            base: "SEALED_CHOICE",
            flow: "reveal",
            key,
            course:
              params.reveal_visibility === "PER_PLAYER" ? "PER_PLAYER" : "AGGREGATE_ONLY",
          },
        };
      },
    },
  }),

  VOTE: Object.freeze({
    code: "VOTE",
    description:
      "表决基座：投/改票、锁票、票权与否决令牌。计票算法以纯函数导出（tallyPlurality 等），供 M09 全族复用。",
    state_regions: ["ballots", "ballotLocked", "votePower", "vetoTokens", "vetoCast"],
    effect_refs: [],
    editable_params: {
      ballot_mode: P(
        "enum",
        "票型：SINGLE=单选、THRESHOLD=赞成反对、RANKING=排序、APPROVAL=多选、WEIGHTED=带权",
        "SINGLE",
      ),
      candidates: P("list", "候选 ID 列表（THRESHOLD 模式忽略，固定 aye/nay/abstain）", ["A", "B"]),
      allow_abstain: P("bool", "是否允许显式弃权", true),
      allow_revise: P("bool", "锁票前是否允许改票", true),
      max_selections: P("int|null", "APPROVAL 每人最多勾选数；null=不限", 2),
      max_weight_per_player: P("int", "WEIGHTED 每人票权上限", 3),
    },
    locked_rules: [
      "锁票后不可再投/改票",
      "多数票只能形成集体决定，不能改写客观事实",
      "票权与否决权必须来自开局规则状态，不能由主持人临时授予超额",
      "多人同时否决只消耗服务器确认的第一枚",
    ],
    flows: {
      cast(state, params, ctx) {
        const key = String(ctx.ballotKey ?? "main");
        const player = String(ctx.player ?? "");
        if (!state.players[player]) {
          fail("BASE_TARGET_UNKNOWN", "VOTE cast unknown player", { player });
        }
        if (state.ballotLocked[key]) {
          fail("BASE_ALREADY_LOCKED", "Cannot cast after ballot lock", { key });
        }
        const existing = state.ballots[key] || {};
        if (existing[player] && !params.allow_revise) {
          fail("BASE_RULE_VIOLATION", "Ballot revise is locked", { player, key });
        }
        const ballot = normalizeBallot(params, ctx.value);
        let votePower = state.votePower;
        if (params.ballot_mode === "WEIGHTED") {
          const cap = Math.max(0, Math.trunc(Number(params.max_weight_per_player) || 0));
          const spent = Number(ballot.spent || 0);
          if (spent > cap) {
            fail("BASE_INSUFFICIENT_POWER", "Weighted spend exceeds max_weight_per_player", {
              player,
              spent,
              cap,
            });
          }
          const remaining = Number(votePower[player] ?? cap);
          if (spent > remaining) {
            fail("BASE_INSUFFICIENT_POWER", "Not enough vote power", {
              player,
              spent,
              remaining,
            });
          }
          // 改票时先退还旧消耗，再扣新消耗
          const prevSpent = Number(existing[player]?.spent || 0);
          votePower = {
            ...votePower,
            [player]: remaining + prevSpent - spent,
          };
        }
        return {
          state: {
            ...state,
            votePower,
            ballots: { ...state.ballots, [key]: { ...existing, [player]: ballot } },
          },
          record: { base: "VOTE", flow: "cast", key, player, mode: params.ballot_mode },
        };
      },
      lock(state, params, ctx) {
        const key = String(ctx.ballotKey ?? "main");
        if (state.ballotLocked[key]) {
          fail("BASE_ALREADY_LOCKED", "Ballot already locked", { key });
        }
        if (!state.ballots[key]) {
          // 允许无人投票时锁票，结算侧输出 NO_DECISION
          return {
            state: {
              ...state,
              ballots: { ...state.ballots, [key]: {} },
              ballotLocked: { ...state.ballotLocked, [key]: true },
            },
            record: { base: "VOTE", flow: "lock", key, empty: true },
          };
        }
        return {
          state: { ...state, ballotLocked: { ...state.ballotLocked, [key]: true } },
          record: { base: "VOTE", flow: "lock", key },
        };
      },
      grant_power(state, params, ctx) {
        const amounts = ctx.amounts && typeof ctx.amounts === "object" ? ctx.amounts : {};
        const fallback = Math.max(0, Math.trunc(Number(params.max_weight_per_player) || 0));
        const votePower = { ...state.votePower };
        const targets = Array.isArray(ctx.players) ? ctx.players.map(String) : Object.keys(state.players);
        for (const player of targets) {
          if (!state.players[player]) {
            fail("BASE_TARGET_UNKNOWN", "VOTE grant_power unknown player", { player });
          }
          votePower[player] =
            amounts[player] !== undefined
              ? Math.max(0, Math.trunc(Number(amounts[player]) || 0))
              : fallback;
        }
        return {
          state: { ...state, votePower },
          record: { base: "VOTE", flow: "grant_power", players: targets },
        };
      },
      grant_veto(state, params, ctx) {
        const amounts = ctx.amounts && typeof ctx.amounts === "object" ? ctx.amounts : {};
        const vetoTokens = { ...state.vetoTokens };
        for (const [player, amountRaw] of Object.entries(amounts)) {
          if (!state.players[player]) {
            fail("BASE_TARGET_UNKNOWN", "VOTE grant_veto unknown player", { player });
          }
          vetoTokens[player] = Math.max(0, Math.trunc(Number(amountRaw) || 0));
        }
        return {
          state: { ...state, vetoTokens },
          record: { base: "VOTE", flow: "grant_veto", holders: Object.keys(amounts) },
        };
      },
      cast_veto(state, params, ctx) {
        const key = String(ctx.ballotKey ?? "main");
        const player = String(ctx.player ?? "");
        if (!state.players[player]) {
          fail("BASE_TARGET_UNKNOWN", "VOTE cast_veto unknown player", { player });
        }
        if (state.vetoCast) {
          fail("BASE_VETO_TAKEN", "A veto was already confirmed", { existing: state.vetoCast });
        }
        const tokens = Number(state.vetoTokens[player] || 0);
        if (tokens < 1) {
          fail("BASE_INSUFFICIENT_VETO", "Player has no veto token", { player });
        }
        return {
          state: {
            ...state,
            vetoTokens: { ...state.vetoTokens, [player]: tokens - 1 },
            vetoCast: { player, ballotKey: key },
          },
          record: { base: "VOTE", flow: "cast_veto", key, player },
        };
      },
    },
  }),
});

/** 校验并实例化一个底层模板：返回绑定了参数的实例，违反 locked_rules 时报错。 */
export function instantiateBaseTemplate(code, params = {}) {
  const tpl = MECHANISM_BASE_TEMPLATES[String(code ?? "")];
  if (!tpl) fail("BASE_UNKNOWN", `Unknown base template ${code}`, { code });
  const out = {};
  for (const [key, spec] of Object.entries(tpl.editable_params)) {
    out[key] = params[key] !== undefined ? params[key] : spec.default;
  }
  // 枚举校验
  if (tpl.editable_params.confirm_mode && !["DOUBLE", "SINGLE"].includes(out.confirm_mode)) {
    fail("BASE_INVALID_PARAMS", "confirm_mode must be DOUBLE or SINGLE", { got: out.confirm_mode });
  }
  if (tpl.editable_params.timing && !["IMMEDIATE", "STAGE_END"].includes(out.timing)) {
    fail("BASE_INVALID_PARAMS", "timing must be IMMEDIATE or STAGE_END", { got: out.timing });
  }
  if (tpl.editable_params.bid_rule && !["INCREMENT", "DECREMENT", "SEALED"].includes(out.bid_rule)) {
    fail("BASE_INVALID_PARAMS", "bid_rule must be INCREMENT/DECREMENT/SEALED", { got: out.bid_rule });
  }
  if (tpl.editable_params.visibility && !["PUBLIC", "SEALED", "LEADER_ONLY"].includes(out.visibility)) {
    fail("BASE_INVALID_PARAMS", "visibility must be PUBLIC/SEALED/LEADER_ONLY", { got: out.visibility });
  }
  if (tpl.editable_params.ballot_mode && !BALLOT_MODES.includes(out.ballot_mode)) {
    fail("BASE_INVALID_PARAMS", "ballot_mode must be SINGLE/THRESHOLD/RANKING/APPROVAL/WEIGHTED", {
      got: out.ballot_mode,
    });
  }
  return Object.freeze({ template: tpl.code, params: Object.freeze(out) });
}

/** 运行某个底层模板的某个流程：返回新状态（含追加的 record 到 log）。 */
export function runBaseFlow(templateCode, flowName, state, paramsOrInstance, ctx = {}) {
  const tpl = MECHANISM_BASE_TEMPLATES[String(templateCode ?? "")];
  if (!tpl) fail("BASE_UNKNOWN", `Unknown base template ${templateCode}`, { templateCode });
  const flow = tpl.flows[String(flowName ?? "")];
  if (!flow) fail("BASE_UNKNOWN_FLOW", `Unknown flow ${flowName} on ${templateCode}`, { flowName });
  const params = paramsOrInstance && paramsOrInstance.params ? paramsOrInstance.params : paramsOrInstance;
  const { state: next, record } = flow(state, params || {}, ctx);
  const log = [...(next.log || []), record];
  return { ...next, log };
}

/** 文档化：把全部底层模板的 code/描述/参数含义/锁定规则导出。 */
export function listBaseTemplateDocuments() {
  return Object.values(MECHANISM_BASE_TEMPLATES).map((t) => ({
    code: t.code,
    description: t.description,
    effect_refs: t.effect_refs,
    locked_rules: t.locked_rules,
    editable_params: Object.fromEntries(
      Object.entries(t.editable_params).map(([k, s]) => [k, s.description]),
    ),
  }));
}

export function describeBaseTemplate(code) {
  return MECHANISM_BASE_TEMPLATES[String(code ?? "")] || null;
}