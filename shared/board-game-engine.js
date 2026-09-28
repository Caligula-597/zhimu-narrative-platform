export const BOARD_GAME_ENGINE_VERSION = 1;

export const BOARD_GAME_MAP_KINDS = Object.freeze(["area_graph", "hex", "square"]);
export const BOARD_GAME_PHASE_MODES = Object.freeze(["sequential", "simultaneous", "reveal"]);
import { appendBoardGameEndAudit, applyBoardGameMaintenance, applyBoardGameProduction, cancelBoardGameTradeOffer, cleanupBoardGameEra, confirmBoardGameTradeOffer, createBoardGameAdvancedState, createBoardGameTradeOffer, drawBoardGameCards, evaluateBoardGameMajority, evaluateBoardGameTileComponents, moveBoardGameCardsToZone, normalizeBoardGameAdvancedState, placeBoardGameTile, resolveBoardGameCombat, resolveBoardGameContribution, resolveBoardGameMarketPurchase, resolveBoardGameTrade } from "./board-game-advanced-primitives.js";
import { deriveBoardGameGridNeighbors } from "./board-game-universal-kits.js";

export const BOARD_GAME_ACTION_KINDS = Object.freeze([
  "move",
  "gain",
  "pay",
  "control",
  "place",
  "score",
  "mechanism",
  "bid",
  "vote",
  "draw",
  "play",
  "draft",
  "claim_route",
  "roll",
  "stop",
  "reveal",
  "pass",
  "discard",
  "trash",
  "place_tile",
  "trade",
  "trade_offer",
  "trade_confirm",
  "trade_cancel",
  "contribute",
  "market_buy",
  "combat"
]);
export const BOARD_GAME_TARGET_KINDS = Object.freeze([
  "none",
  "any_region",
  "adjacent_region",
  "unowned_region",
  "own_region",
  "opponent_region",
  "any_route",
  "opponent_seat",
  "market_card",
  "empty_tile",
  "trade_offer"
]);

export const BOARD_GAME_ENGINE_CAPABILITIES = Object.freeze([
  { id: "map.area_graph", label: "区域与路线地图", status: "supported", note: "区域、坐标、路线与通行费用均由数据生成。" },
  { id: "map.hex", label: "六角格地图", status: "supported", note: "通用六角坐标、邻接、六向边匹配和旋转由运行时处理；编辑器视觉网格仍可独立增强。" },
  { id: "map.square", label: "方格地图", status: "supported", note: "通用方格坐标、邻接、四向边匹配和旋转由运行时处理；编辑器视觉网格仍可独立增强。" },
  { id: "phase.sequential", label: "顺序行动", status: "supported", note: "按席位顺序执行并推进阶段。" },
  { id: "phase.simultaneous", label: "同时选择", status: "supported", note: "逐席位提交后统一公开并按声明顺序结算。" },
  { id: "phase.reveal", label: "同时选择后公开", status: "supported", note: "提交期间隐藏选择，全部提交后统一结算。" },
  { id: "action.move", label: "移动", status: "supported", note: "支持相邻区域和指定区域移动。" },
  { id: "action.gain", label: "获得资源", status: "supported", note: "按变量作用域增加资源。" },
  { id: "action.pay", label: "支付资源", status: "supported", note: "先检查资源，再执行扣除。" },
  { id: "action.control", label: "控制区域", status: "supported", note: "写入区域控制者。" },
  { id: "action.place", label: "工人放置", status: "supported", note: "把当前席位的工人放到合法空置区域。" },
  { id: "action.score", label: "计分", status: "supported", note: "更新席位分数或绑定变量。" },
  { id: "action.mechanism", label: "执行条件效果", status: "supported", note: "执行编辑器中的条件与效果规则。" },
  { id: "action.pass", label: "跳过行动", status: "supported", note: "记录跳过并继续流程。" },
  { id: "action.bid", label: "密封竞价与比较", status: "supported", note: "并发提交后支持最高价、最低价、第二价格、同目标校验和轮转裁决。" },
  { id: "action.vote", label: "公开表决与多数结算", status: "supported", note: "公开阶段统计正反票，平票按声明的否决结果处理。" },
  { id: "action.draw", label: "抽牌", status: "supported", note: "从公共牌库扣除牌数并增加席位手牌。" },
  { id: "action.play", label: "打出卡牌", status: "supported", note: "消耗席位手牌并触发绑定机制效果。" },
  { id: "action.draft", label: "公开轮抽", status: "supported", note: "所有席位同时从公共市场选择不同卡牌，结算后进入个人收藏。" },
  { id: "action.claim_route", label: "路线争夺", status: "supported", note: "支付与路线长度对应的资源，取得公共路线并按长度计分。" },
  { id: "action.roll", label: "风险掷骰", status: "supported", note: "使用确定性随机掷骰推进本轮风险，允许继续或停手。" },
  { id: "action.stop", label: "风险停手", status: "supported", note: "把当前风险进度安全结算为个人分数。" },
  { id: "action.contribute", label: "投入公共目标", status: "supported", note: "席位将资源原子投入共享危机池，并写入公开响应。" },
  { id: "action.place_tile", label: "地块放置", status: "supported", note: "从席位私有地块手牌中取出地块，按邻接与拓扑规则放入空置格位。" },
  { id: "action.reveal", label: "公开对象", status: "supported", note: "支持公共、席位私密和团队私密揭示，并在玩家投影中按权限返回。" },
  { id: "effects.response_standard", label: "标准效果响应链", status: "supported", note: "支持作用域、条件、优先级、延迟时机、重复、连锁、可见性和逐条 before/after 审计。" },
  { id: "timing.response_window", label: "玩家反应窗口", status: "supported", note: "顺序行动后的玩家响应支持最多三层嵌套，带服务端截止时间、默认响应、外层恢复和超时审计。" },
  { id: "card.zones", label: "牌区移动与牌库操作", status: "supported", note: "抽牌、弃置、移除、桌面区、公共牌库洗回和席位独立牌库洗回均由统一原语处理。" },
  { id: "map.topology_placement", label: "拓扑拼图与邻接放置", status: "supported", note: "支持邻接、旋转、边缘匹配、连通组件、多数归属和配置化连通计分。" },
  { id: "random.dice_production", label: "骰子生产与概率供给", status: "supported", note: "支持多骰、多区间、多资源、全员/个人生产、灾害负产出和可复现骰史。" },
  { id: "interaction.trade_window", label: "交易窗口与原子转移", status: "supported", note: "支持发起、双方确认、撤回、资源边界和原子结算；立即交易仍可用。" },
  { id: "resource.market_curve", label: "供需市场价格曲线", status: "supported", note: "支持价格偏移、上下限、供给修正、补货和公共市场响应。" },
  { id: "action.combat", label: "战斗与损失结算", status: "supported", note: "支持攻防修正、护盾吸收、伤害上限、撤退、控制转移和战斗日志。" },
  { id: "role.faction_plugin", label: "派系规则插件", status: "supported", note: "通用插件支持起始状态、行动锁、轮末/终局机制；专属阶段和复杂胜利条件通过派系配置扩展。" },
  { id: "score.endgame_audit", label: "多条件终局审计", status: "supported", note: "统一审计回合、变量、区域多数、连通组件、隐藏目标、派系钩子、终局倍率和平局顺序。" },
  { id: "pacing.multi_era_cleanup", label: "多时代清理与转换", status: "supported", note: "支持按时代清理牌库/市场/手牌/桌面资产，并记录迁移、退役和阶段转换。" },
  { id: "interaction.cooperation", label: "合作公共目标与危机", status: "supported", note: "支持公共资源池投入、危机阈值和失败轨道的基础运行时协议。" },
  { id: "timing.action_cooldown", label: "行动轨道与冷却", status: "supported", note: "支持行动冷却、行动轨道定位和跨格跳跃支付，配置未启用时保持普通行动语义。" },
  { id: "info.public", label: "公开信息", status: "supported", note: "所有试玩状态均可公开呈现。" },
  { id: "info.private", label: "个人私密信息", status: "supported", note: "线上运行时通过 publicState 与 viewerState 分离未公开手牌；单屏试玩只展示当前测试席位。" },
  { id: "info.team", label: "团队私密信息", status: "supported", note: "团队归属、团队揭示和团队响应均按 viewer seat 投影，单屏试玩也不会泄露其他团队内容。" },
  { id: "random.seeded", label: "可复现随机", status: "supported", note: "牌堆初始化使用确定性种子，回放可复现相同顺序。" }
]);

const CAPABILITY_BY_ID = new Map(BOARD_GAME_ENGINE_CAPABILITIES.map((item) => [item.id, item]));
const BOARD_GAME_EFFECT_SCOPES = new Set(["auto", "self", "global", "all_players", "target_player"]);
const BOARD_GAME_EFFECT_TIMINGS = new Set(["immediate", "after_action", "round_end"]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maxLength = 800) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function number(value, fallback = 0, min = -1_000_000_000, max = 1_000_000_000) {
  const parsed = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
}

function integer(value, fallback, min, max) {
  return Math.round(number(value, fallback, min, max));
}

function identifier(value, fallback) {
  const normalized = text(value, 80).replace(/[^a-zA-Z0-9_-]/g, "-");
  return normalized || fallback;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value ?? "board-game")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandom(state) {
  const current = hashSeed(state.randomState || state.seed || "board-game");
  const next = (Math.imul(current, 1664525) + 1013904223) >>> 0;
  state.randomState = String(next);
  return next / 4294967296;
}

function shuffled(items, state) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(nextRandom(state) * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function clone(value) {
  return structuredClone(value);
}

function duplicateIds(items = []) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of items) {
    if (!item?.id) continue;
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return [...duplicates];
}

function issue(level, code, message, path = "") {
  return { level, code, message, path };
}

function normalizeMapNode(value, index = 0) {
  const source = record(value);
  return {
    id: identifier(source.id, `region-${index + 1}`),
    label: text(source.label || source.name, 120) || `区域 ${index + 1}`,
    x: number(source.x, 15 + (index % 4) * 23, 4, 96),
    y: number(source.y, 20 + Math.floor(index / 4) * 40, 6, 94),
    gridX: source.gridX == null && source.q == null ? null : integer(source.gridX ?? source.q, 0, -999, 999),
    gridY: source.gridY == null && source.r == null ? null : integer(source.gridY ?? source.r, 0, -999, 999),
    terrain: identifier(source.terrain, "plain"),
    capacity: integer(source.capacity, 99, 1, 999),
    scoreValue: number(source.scoreValue, 0, -9999, 9999),
    initialOwner: Number.isInteger(Number(source.initialOwner)) ? integer(source.initialOwner, -1, -1, 98) : -1,
    description: text(source.description, 600)
  };
}

function normalizeMapEdge(value, index = 0) {
  const source = record(value);
  return {
    id: identifier(source.id, `route-${index + 1}`),
    from: identifier(source.from, ""),
    to: identifier(source.to, ""),
    cost: number(source.cost, 1, 0, 9999),
    blocked: Boolean(source.blocked),
    bidirectional: source.bidirectional !== false,
    fromSide: ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"].includes(source.fromSide) ? source.fromSide : "",
    toSide: ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"].includes(source.toSide) ? source.toSide : "",
    label: text(source.label, 100)
  };
}

function normalizePhase(value, index = 0) {
  const source = record(value);
  return {
    id: identifier(source.id, `phase-${index + 1}`),
    label: text(source.label || source.name, 120) || `阶段 ${index + 1}`,
    mode: BOARD_GAME_PHASE_MODES.includes(source.mode) ? source.mode : "sequential",
    actionIds: (Array.isArray(source.actionIds) ? source.actionIds : []).slice(0, 100).map((item) => identifier(item, "")).filter(Boolean),
    deckId: identifier(source.deckId, ""),
    description: text(source.description, 800),
    votePassMechanismId: identifier(source.votePassMechanismId, ""),
    voteFailMechanismId: identifier(source.voteFailMechanismId, "")
  };
}

function normalizeAction(value, index = 0) {
  const source = record(value);
  const kind = BOARD_GAME_ACTION_KINDS.includes(source.kind) ? source.kind : "mechanism";
  return {
    id: identifier(source.id, `action-${index + 1}`),
    label: text(source.label || source.name, 120) || `行动 ${index + 1}`,
    kind,
    phaseId: identifier(source.phaseId, ""),
    target: BOARD_GAME_TARGET_KINDS.includes(source.target) ? source.target : "none",
    targetTerrain: identifier(source.targetTerrain, ""),
    resourceKey: identifier(source.resourceKey, ""),
    deckId: identifier(source.deckId, ""),
    cardId: identifier(source.cardId, ""),
    cost: number(source.cost, 0, 0, 999999),
    amount: number(source.amount, kind === "pay" ? 1 : 0, -999999, 999999),
    rollCount: integer(source.rollCount, 2, 1, 8),
    rollSides: integer(source.rollSides, 6, 2, 20),
    bustThreshold: number(source.bustThreshold, 18, 1, 999999),
    keepTurn: Boolean(source.keepTurn),
    reshuffleOnEmpty: source.reshuffleOnEmpty !== false,
    cardDestination: ["discard", "tableau", "removed"].includes(source.cardDestination) ? source.cardDestination : "discard",
    deckScope: source.deckScope === "personal" ? "personal" : "shared",
    targetSeatIndex: Number.isInteger(Number(source.targetSeatIndex)) ? integer(source.targetSeatIndex, 0, 0, 98) : null,
    tradeGiveKey: identifier(source.tradeGiveKey, ""),
    tradeReceiveKey: identifier(source.tradeReceiveKey, ""),
    tradeGiveAmount: number(source.tradeGiveAmount, 1, 1, 999999),
    tradeReceiveAmount: number(source.tradeReceiveAmount, 1, 1, 999999),
    attackKey: identifier(source.attackKey, "attack"),
    defenseKey: identifier(source.defenseKey, "defense"),
    damageKey: identifier(source.damageKey, "damage"),
    combatScoreKey: identifier(source.combatScoreKey, "score"),
    allowTileReplace: Boolean(source.allowTileReplace),
    marketPriceDelta: number(source.marketPriceDelta, 1, -999999, 999999),
    marketRestock: source.marketRestock !== false,
    marketDestination: ["tableau", "discard"].includes(source.marketDestination) ? source.marketDestination : "tableau",
    marketPriceFloor: number(source.marketPriceFloor, 0, -999999, 999999),
    marketPriceCeiling: number(source.marketPriceCeiling, 999999, -999999, 999999),
    marketSupplyDelta: number(source.marketSupplyDelta, 0, -999999, 999999),
    tileRotation: integer(source.tileRotation, 0, 0, 5),
    tileRequireAdjacent: Boolean(source.tileRequireAdjacent),
    tileMatchEdges: Boolean(source.tileMatchEdges),
    attackBonus: number(source.attackBonus, 0, -999999, 999999),
    defenseBonus: number(source.defenseBonus, 0, -999999, 999999),
    damageCap: number(source.damageCap, 999999, 0, 999999),
    shieldKey: identifier(source.shieldKey, ""),
    retreatTargetId: identifier(source.retreatTargetId, ""),
    controlTargetId: identifier(source.controlTargetId, ""),
    cooldownRounds: integer(source.cooldownRounds, 0, 0, 99),
    rondelStep: integer(source.rondelStep, 1, 1, 99),
    revealVisibility: ["public", "private", "team"].includes(source.revealVisibility) ? source.revealVisibility : "public",
    revealCount: integer(source.revealCount, 1, 1, 20),
    revealApplyEffects: Boolean(source.revealApplyEffects),
    responseActionIds: (Array.isArray(source.responseActionIds) ? source.responseActionIds : []).slice(0, 20).map((id) => identifier(id, "")).filter(Boolean),
    responseSeatMode: ["all_other_players", "all_players", "target_player"].includes(source.responseSeatMode) ? source.responseSeatMode : "all_other_players",
    responseTimeoutSeconds: integer(source.responseTimeoutSeconds, 15, 1, 3600),
    responseDefaultActionId: identifier(source.responseDefaultActionId, ""),
    bidMode: ["highest", "lowest", "second_price"].includes(source.bidMode) ? source.bidMode : "highest",
    bidTieMode: ["rotation", "first"].includes(source.bidTieMode) ? source.bidTieMode : "rotation",
    bidSecondPriceOffset: number(source.bidSecondPriceOffset, 0, 0, 999999),
    bidTargetId: identifier(source.bidTargetId, ""),
    contributionPoolKey: identifier(source.contributionPoolKey, "crisis"),
    factionId: identifier(source.factionId, ""),
    productionRules: (Array.isArray(source.productionRules) ? source.productionRules : []).slice(0, 40).map((rule) => ({
      min: number(rule?.min, 0),
      max: number(rule?.max, 999999),
      variableKey: identifier(rule?.variableKey, ""),
      amount: number(rule?.amount, 1),
      scope: rule?.scope === "all_players" ? "all_players" : "self"
    })).filter((rule) => rule.variableKey),
    marketSize: integer(source.marketSize, 4, 1, 20),
    mechanismId: identifier(source.mechanismId, ""),
    draftMode: ["public_market", "hand"].includes(source.draftMode) ? source.draftMode : "public_market",
    description: text(source.description, 1200)
  };
}

export function createDefaultBoardGameEngine() {
  return {
    version: BOARD_GAME_ENGINE_VERSION,
    maxRounds: 6,
    map: { kind: "area_graph", nodes: [], edges: [] },
    phases: [],
    actions: [],
    setup: { unitsPerSeat: 1, startingNodeIds: [] },
    roundEffects: [],
    endCondition: { type: "rounds", variableKey: "", operator: "gte", value: 6 },
    endConditions: [],
    information: "public"
  };
}

export function normalizeBoardGameEngine(value = {}) {
  const source = record(value);
  const map = record(source.map);
  const setup = record(source.setup);
  const endCondition = record(source.endCondition);
  const maxRounds = integer(source.maxRounds, 6, 1, 999);
  return {
    version: BOARD_GAME_ENGINE_VERSION,
    maxRounds,
    map: {
      kind: BOARD_GAME_MAP_KINDS.includes(map.kind) ? map.kind : "area_graph",
      nodes: (Array.isArray(map.nodes) ? map.nodes : []).slice(0, 500).map(normalizeMapNode),
      edges: (Array.isArray(map.edges) ? map.edges : []).slice(0, 2000).map(normalizeMapEdge)
    },
    phases: (Array.isArray(source.phases) ? source.phases : []).slice(0, 100).map(normalizePhase),
    actions: (Array.isArray(source.actions) ? source.actions : []).slice(0, 500).map(normalizeAction),
    setup: {
      unitsPerSeat: integer(setup.unitsPerSeat, 1, 0, 30),
      startingNodeIds: (Array.isArray(setup.startingNodeIds) ? setup.startingNodeIds : []).slice(0, 99).map((item) => identifier(item, "")).filter(Boolean),
      rotateFirstSeat: Boolean(setup.rotateFirstSeat),
      marketSize: integer(setup.marketSize, 4, 1, 20),
      handSize: integer(setup.handSize, 7, 1, 30),
      draftTurnsPerAge: integer(setup.draftTurnsPerAge, 6, 1, 30),
      draftAgeCount: integer(setup.draftAgeCount, 3, 1, 12),
      draftPassDirections: (Array.isArray(setup.draftPassDirections) ? setup.draftPassDirections : ["right", "left", "right"]).slice(0, 12).map((item) => item === "left" ? "left" : "right"),
      factionRules: (Array.isArray(setup.factionRules) ? setup.factionRules : []).slice(0, 99).map((rule) => ({
        id: identifier(rule?.id, ""),
        label: text(rule?.label, 160),
        startingSeat: Number.isInteger(Number(rule?.startingSeat)) ? integer(rule.startingSeat, 0, 0, 98) : null,
        flags: record(rule?.flags),
        counters: record(rule?.counters),
        initialValues: record(rule?.initialValues),
        blockedActionIds: (Array.isArray(rule?.blockedActionIds) ? rule.blockedActionIds : []).map((id) => identifier(id, "")).filter(Boolean),
        roundMechanismId: identifier(rule?.roundMechanismId, ""),
        endMechanismId: identifier(rule?.endMechanismId, "")
      })).filter((rule) => rule.id),
      tileTopology: {
        requireAdjacent: Boolean(setup.tileTopology?.requireAdjacent),
        matchEdges: Boolean(setup.tileTopology?.matchEdges),
        gridAdjacency: setup.tileTopology?.gridAdjacency !== false,
        firstPlacementIds: (Array.isArray(setup.tileTopology?.firstPlacementIds) ? setup.tileTopology.firstPlacementIds : []).slice(0, 100).map((id) => identifier(id, "")).filter(Boolean),
        scoringRules: (Array.isArray(setup.tileTopology?.scoringRules) ? setup.tileTopology.scoringRules : []).slice(0, 40).map((rule, index) => ({
          id: identifier(rule?.id, `tile-score-${index + 1}`),
          tag: identifier(rule?.tag, ""),
          minSize: integer(rule?.minSize, 1, 1, 999),
          points: number(rule?.points, 0, 0, 999999)
        })).filter((rule) => rule.points > 0)
      },
      maintenanceRules: (Array.isArray(setup.maintenanceRules) ? setup.maintenanceRules : []).slice(0, 40).map((rule) => ({
        resourceKey: identifier(rule?.resourceKey, ""),
        cost: number(rule?.cost, 0, 0, 999999),
        penaltyKey: identifier(rule?.penaltyKey, ""),
        penaltyAmount: number(rule?.penaltyAmount, 1, 0, 999999),
        scope: rule?.scope === "self" ? "self" : "all_players",
        seatIndex: Number.isInteger(Number(rule?.seatIndex)) ? integer(rule.seatIndex, 0, 0, 98) : 0
      })).filter((rule) => rule.resourceKey),
      eraCleanup: {
        everyRounds: integer(setup.eraCleanup?.everyRounds, 0, 0, 999),
        deckIds: (Array.isArray(setup.eraCleanup?.deckIds) ? setup.eraCleanup.deckIds : []).slice(0, 40).map((id) => identifier(id, "")).filter(Boolean),
        discardMarket: Boolean(setup.eraCleanup?.discardMarket),
        zones: (Array.isArray(setup.eraCleanup?.zones) ? setup.eraCleanup.zones : ["decks", "market"]).filter((zone) => ["decks", "market", "hands", "claimedCards", "tableaus", "personalDecks", "personalDiscardPiles"].includes(zone)),
        migrateToAge: setup.eraCleanup?.migrateToAge == null ? null : integer(setup.eraCleanup.migrateToAge, 0, 0, 99),
        migrationDeckId: identifier(setup.eraCleanup?.migrationDeckId, "")
      },
      actionTrack: {
        enabled: Boolean(setup.actionTrack?.enabled),
        actionIds: (Array.isArray(setup.actionTrack?.actionIds) ? setup.actionTrack.actionIds : []).map((id) => identifier(id, "")).filter(Boolean),
        jumpResourceKey: identifier(setup.actionTrack?.jumpResourceKey, ""),
        jumpCostPerStep: number(setup.actionTrack?.jumpCostPerStep, 1, 0, 999999),
        wrapAround: setup.actionTrack?.wrapAround !== false
      },
      teamAssignments: (Array.isArray(setup.teamAssignments) ? setup.teamAssignments : []).slice(0, 99).map((id, index) => identifier(id, `team-${index + 1}`)),
      endgameMultipliers: (Array.isArray(setup.endgameMultipliers) ? setup.endgameMultipliers : []).slice(0, 40).map((item, index) => ({
        id: identifier(item?.id, `end-multiplier-${index + 1}`),
        variableKey: identifier(item?.variableKey, "score"),
        operator: ["eq", "gt", "gte", "lt", "lte"].includes(item?.operator) ? item.operator : "gte",
        value: number(item?.value, 0),
        multiplier: number(item?.multiplier, 1, -999, 999),
        points: number(item?.points, 0, -999999, 999999),
        scope: item?.scope === "global" ? "global" : "player"
      })),
      tieBreakOrder: (Array.isArray(setup.tieBreakOrder) ? setup.tieBreakOrder : ["score", "objective", "seatIndex"]).map((key) => identifier(key, "score")).filter(Boolean),
      majorityRules: (Array.isArray(setup.majorityRules) ? setup.majorityRules : []).slice(0, 40).map((rule, index) => ({
        id: identifier(rule?.id, `majority-${index + 1}`),
        nodeIds: (Array.isArray(rule?.nodeIds) ? rule.nodeIds : []).map((id) => identifier(id, "")).filter(Boolean),
        points: number(rule?.points, 0, 0, 999999),
        unitValue: number(rule?.unitValue, 1, 1, 999999),
        tieMode: ["all", "none", "split"].includes(rule?.tieMode) ? rule.tieMode : "all"
      })).filter((rule) => rule.nodeIds.length),
      hiddenObjectives: (Array.isArray(setup.hiddenObjectives) ? setup.hiddenObjectives : []).slice(0, 99).map((objective, index) => ({
        id: identifier(objective?.id, `objective-${index + 1}`),
        label: text(objective?.label, 160),
        variableKey: identifier(objective?.variableKey, ""),
        operator: ["eq", "gt", "gte", "lt", "lte"].includes(objective?.operator) ? objective.operator : "gte",
        value: number(objective?.value, 0),
        points: number(objective?.points, 0, 0, 999999)
      })).filter((objective) => objective.variableKey),
      responseTimeoutSeconds: integer(setup.responseTimeoutSeconds, 15, 1, 3600),
      personalDecks: (Array.isArray(setup.personalDecks) ? setup.personalDecks : []).slice(0, 40).map((item, index) => ({
        deckId: identifier(item?.deckId, `personal-deck-${index + 1}`),
        entryIds: (Array.isArray(item?.entryIds) ? item.entryIds : []).map((id) => identifier(id, "")).filter(Boolean),
        initialHandSize: integer(item?.initialHandSize, 0, 0, 30),
        cardLimit: integer(item?.cardLimit, 999, 1, 999)
      })).filter((item) => item.deckId),
      playerInitialValues: (Array.isArray(setup.playerInitialValues) ? setup.playerInitialValues : []).slice(0, 99).map((item) => record(item)),
      seed: text(setup.seed, 120) || "board-game-v1"
    },
    roundEffects: (Array.isArray(source.roundEffects) ? source.roundEffects : []).slice(0, 50).map((item, index) => ({
      id: identifier(item?.id, `round-effect-${index + 1}`),
      targetKey: identifier(item?.targetKey, ""),
      operation: ["set", "add", "subtract", "multiply", "min", "max", "toggle"].includes(item?.operation) ? item.operation : "add",
      value: text(item?.value, 120),
      scope: BOARD_GAME_EFFECT_SCOPES.has(item?.scope) ? item.scope : "all_players"
    })),
    endCondition: {
      type: endCondition.type === "variable_threshold" ? "variable_threshold" : "rounds",
      variableKey: identifier(endCondition.variableKey, ""),
      operator: ["eq", "gt", "gte", "lt", "lte"].includes(endCondition.operator) ? endCondition.operator : "gte",
      value: number(endCondition.value, maxRounds)
    },
    endConditions: (Array.isArray(source.endConditions) ? source.endConditions : []).slice(0, 10).map((item, index) => ({
      variableKey: identifier(item?.variableKey, ""),
      operator: ["eq", "gt", "gte", "lt", "lte"].includes(item?.operator) ? item.operator : "gte",
      value: number(item?.value, 0),
      id: identifier(item?.id, `end-condition-${index + 1}`)
    })),
    information: ["public", "private", "team"].includes(source.information) ? source.information : "public"
  };
}

export function boardGameCapability(id) {
  return CAPABILITY_BY_ID.get(id) || { id, label: id, status: "unsupported", note: "当前引擎没有登记这项能力。" };
}

export function assessBoardGameEngineCapabilities(value) {
  const engine = normalizeBoardGameEngine(value?.engine || value);
  const requested = new Set([
    `map.${engine.map.kind}`,
    `info.${engine.information}`,
    ...engine.phases.map((phase) => `phase.${phase.mode}`),
    ...engine.actions.map((action) => `action.${action.kind}`)
  ]);
  const checks = [...requested].map(boardGameCapability);
  return {
    checks,
    supported: checks.filter((item) => item.status === "supported").length,
    partial: checks.filter((item) => item.status === "partial").length,
    unsupported: checks.filter((item) => item.status === "unsupported").length,
    runnable: checks.every((item) => item.status === "supported")
  };
}

export function compileBoardGameEngine(designValue, roleCount = 0) {
  const design = record(designValue);
  const engine = normalizeBoardGameEngine(design.engine);
  const issues = [];
  const nodeIds = new Set(engine.map.nodes.map((item) => item.id));
  const phaseIds = new Set(engine.phases.map((item) => item.id));
  const actionIds = new Set(engine.actions.map((item) => item.id));
  const mechanismIds = new Set((Array.isArray(design.mechanisms) ? design.mechanisms : []).map((item) => item.id));
  const variableIds = new Set((Array.isArray(design.variables) ? design.variables : []).map((item) => item.id));
  const deckIds = new Set((Array.isArray(design.components) ? design.components : []).filter((item) => item.type === "deck").map((item) => item.id));
  const factionIds = new Set(engine.setup.factionRules.map((rule) => rule.id));
  const componentCards = (Array.isArray(design.components) ? design.components : [])
    .filter((component) => component.type === "deck")
    .flatMap((component) => (Array.isArray(component.entries) ? component.entries : []).map((entry) => ({ component, entry })));

  for (const [collection, items] of [["区域", engine.map.nodes], ["路线", engine.map.edges], ["阶段", engine.phases], ["行动", engine.actions]]) {
    for (const id of duplicateIds(items)) issues.push(issue("error", "ENGINE_ID_DUPLICATE", `${collection} ID「${id}」重复。`, "engine"));
  }
  if (!engine.map.nodes.length) issues.push(issue("error", "ENGINE_MAP_EMPTY", "试玩引擎没有区域数据。", "engine.map.nodes"));
  if (!engine.phases.length) issues.push(issue("error", "ENGINE_PHASES_EMPTY", "试玩引擎没有阶段数据。", "engine.phases"));
  if (!engine.actions.length) issues.push(issue("error", "ENGINE_ACTIONS_EMPTY", "试玩引擎没有行动数据。", "engine.actions"));
  engine.map.edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) issues.push(issue("error", "ENGINE_ROUTE_NODE_MISSING", `路线「${edge.id}」引用了不存在的区域。`, `engine.map.edges.${index}`));
    if (edge.from === edge.to) issues.push(issue("error", "ENGINE_ROUTE_SELF", `路线「${edge.id}」不能连接同一区域。`, `engine.map.edges.${index}`));
  });
  engine.setup.startingNodeIds.forEach((nodeId, index) => {
    if (!nodeIds.has(nodeId)) issues.push(issue("error", "ENGINE_START_NODE_MISSING", `起始区域「${nodeId}」不存在。`, `engine.setup.startingNodeIds.${index}`));
  });
  engine.phases.forEach((phase, phaseIndex) => {
    if (!phase.actionIds.length) issues.push(issue("error", "ENGINE_PHASE_ACTIONS_EMPTY", `阶段「${phase.label}」没有可执行行动。`, `engine.phases.${phaseIndex}.actionIds`));
    phase.actionIds.forEach((actionId) => {
      if (!actionIds.has(actionId)) issues.push(issue("error", "ENGINE_PHASE_ACTION_MISSING", `阶段「${phase.label}」引用了不存在的行动「${actionId}」。`, `engine.phases.${phaseIndex}.actionIds`));
    });
  });
  engine.actions.forEach((action, index) => {
    if (!phaseIds.has(action.phaseId)) issues.push(issue("error", "ENGINE_ACTION_PHASE_MISSING", `行动「${action.label}」没有有效阶段。`, `engine.actions.${index}.phaseId`));
    if (action.mechanismId && !mechanismIds.has(action.mechanismId)) issues.push(issue("error", "ENGINE_ACTION_MECHANISM_MISSING", `行动「${action.label}」引用了不存在的条件效果。`, `engine.actions.${index}.mechanismId`));
    if (action.deckId && !deckIds.has(action.deckId)) issues.push(issue("error", "ENGINE_ACTION_DECK_MISSING", `行动「${action.label}」引用了不存在的牌堆。`, `engine.actions.${index}.deckId`));
    if ((action.resourceKey || action.cost > 0 || ["gain", "pay"].includes(action.kind)) && !variableIds.has(action.resourceKey)) {
      issues.push(issue("error", "ENGINE_ACTION_VARIABLE_MISSING", `行动「${action.label}」没有绑定有效资源数值。`, `engine.actions.${index}.resourceKey`));
    }
    if (["trade", "trade_offer"].includes(action.kind)) {
      for (const key of [action.tradeGiveKey, action.tradeReceiveKey]) if (!variableIds.has(key)) issues.push(issue("error", "ENGINE_TRADE_VARIABLE_MISSING", `交易行动「${action.label}」引用了不存在的资源「${key}」。`, `engine.actions.${index}`));
    }
    if (action.kind === "combat") {
      for (const key of [action.attackKey, action.defenseKey, action.damageKey, action.combatScoreKey]) if (!variableIds.has(key)) issues.push(issue("error", "ENGINE_COMBAT_VARIABLE_MISSING", `战斗行动「${action.label}」引用了不存在的数值「${key}」。`, `engine.actions.${index}`));
      if (action.shieldKey && !variableIds.has(action.shieldKey)) issues.push(issue("error", "ENGINE_COMBAT_SHIELD_VARIABLE_MISSING", `战斗行动「${action.label}」引用了不存在的护盾数值「${action.shieldKey}」。`, `engine.actions.${index}`));
    }
    if (action.factionId && !factionIds.has(action.factionId)) issues.push(issue("error", "ENGINE_FACTION_MISSING", `行动「${action.label}」引用了不存在的派系「${action.factionId}」。`, `engine.actions.${index}.factionId`));
    for (const responseActionId of action.responseActionIds) {
      const responseAction = engine.actions.find((candidate) => candidate.id === responseActionId);
      if (!responseAction) issues.push(issue("error", "ENGINE_RESPONSE_ACTION_MISSING", `行动「${action.label}」引用了不存在的反应行动「${responseActionId}」。`, `engine.actions.${index}.responseActionIds`));
      else if (responseAction.id === action.id) issues.push(issue("error", "ENGINE_RESPONSE_ACTION_SELF", `行动「${action.label}」不能把自己作为反应行动。`, `engine.actions.${index}.responseActionIds`));
    }
    if (action.responseDefaultActionId && !action.responseActionIds.includes(action.responseDefaultActionId)) {
      issues.push(issue("error", "ENGINE_RESPONSE_DEFAULT_NOT_ALLOWED", `行动「${action.label}」的超时默认行动不在允许的反应行动列表中。`, `engine.actions.${index}.responseDefaultActionId`));
    }
    if (action.responseActionIds.length && engine.phases.find((phase) => phase.id === action.phaseId)?.mode !== "sequential") {
      issues.push(issue("error", "ENGINE_RESPONSE_PHASE_UNSUPPORTED", `行动「${action.label}」的玩家反应窗口目前必须位于顺序行动阶段。`, `engine.actions.${index}.responseActionIds`));
    }
    action.productionRules.forEach((rule, ruleIndex) => {
      if (!variableIds.has(rule.variableKey)) issues.push(issue("error", "ENGINE_PRODUCTION_VARIABLE_MISSING", `骰点生产「${action.label}」引用了不存在的数值「${rule.variableKey}」。`, `engine.actions.${index}.productionRules.${ruleIndex}`));
    });
  });
  engine.setup.factionRules.forEach((rule, index) => {
    for (const actionId of rule.blockedActionIds) if (!actionIds.has(actionId)) issues.push(issue("error", "ENGINE_FACTION_BLOCKED_ACTION_MISSING", `派系「${rule.label || rule.id}」限制了不存在的行动「${actionId}」。`, `engine.setup.factionRules.${index}.blockedActionIds`));
    for (const mechanismId of [rule.roundMechanismId, rule.endMechanismId].filter(Boolean)) if (!mechanismIds.has(mechanismId)) issues.push(issue("error", "ENGINE_FACTION_MECHANISM_MISSING", `派系「${rule.label || rule.id}」引用了不存在的派系机制「${mechanismId}」。`, `engine.setup.factionRules.${index}`));
  });
  engine.setup.maintenanceRules.forEach((rule, index) => {
    for (const key of [rule.resourceKey, rule.penaltyKey].filter(Boolean)) if (!variableIds.has(key)) issues.push(issue("error", "ENGINE_MAINTENANCE_VARIABLE_MISSING", `维护规则引用了不存在的数值「${key}」。`, `engine.setup.maintenanceRules.${index}`));
  });
  engine.setup.hiddenObjectives.forEach((objective, index) => {
    if (!variableIds.has(objective.variableKey)) issues.push(issue("error", "ENGINE_OBJECTIVE_VARIABLE_MISSING", `隐藏目标引用了不存在的数值「${objective.variableKey}」。`, `engine.setup.hiddenObjectives.${index}`));
  });
  engine.setup.endgameMultipliers.forEach((rule, index) => {
    if (!variableIds.has(rule.variableKey)) issues.push(issue("error", "ENGINE_END_MULTIPLIER_VARIABLE_MISSING", `终局倍率引用了不存在的数值「${rule.variableKey}」。`, `engine.setup.endgameMultipliers.${index}`));
    if (!variableIds.has("score")) issues.push(issue("error", "ENGINE_SCORE_VARIABLE_MISSING", "终局倍率需要一个席位分数变量「score」。", "variables"));
  });
  engine.setup.actionTrack.actionIds.forEach((actionId, index) => {
    if (!actionIds.has(actionId)) issues.push(issue("error", "ENGINE_ACTION_TRACK_ACTION_MISSING", `行动轨道引用了不存在的行动「${actionId}」。`, `engine.setup.actionTrack.actionIds.${index}`));
  });
  engine.setup.personalDecks.forEach((personalDeck, index) => {
    if (!deckIds.has(personalDeck.deckId)) issues.push(issue("error", "ENGINE_PERSONAL_DECK_MISSING", `个人牌库配置引用了不存在的牌堆「${personalDeck.deckId}」。`, `engine.setup.personalDecks.${index}.deckId`));
  });
  engine.roundEffects.forEach((effect, index) => {
    if (!variableIds.has(effect.targetKey)) issues.push(issue("error", "ENGINE_ROUND_EFFECT_VARIABLE_MISSING", `回合效果引用了不存在的数值「${effect.targetKey}」。`, `engine.roundEffects.${index}`));
  });
  componentCards.forEach(({ component, entry }) => {
    const cardEffects = [
      ...(entry.effects || []),
      ...(entry.continuousEffects || []),
      ...(entry.triggers || []).flatMap((trigger) => trigger.effects || [])
    ];
    cardEffects.forEach((effect, effectIndex) => {
      if (!variableIds.has(effect.targetKey)) {
        issues.push(issue("error", "ENGINE_CARD_EFFECT_VARIABLE_MISSING", `卡牌「${entry.name}」的效果引用了不存在的数值「${effect.targetKey}」。`, `components.${component.id}.entries.${entry.id}.effects.${effectIndex}`));
      }
      (effect.conditions || []).forEach((condition, conditionIndex) => {
        if (!variableIds.has(condition.sourceKey)) issues.push(issue("error", "ENGINE_CARD_EFFECT_CONDITION_VARIABLE_MISSING", `卡牌「${entry.name}」的条件引用了不存在的数值「${condition.sourceKey}」。`, `components.${component.id}.entries.${entry.id}.effects.${effectIndex}.conditions.${conditionIndex}`));
      });
      if (effect.chainMechanismId && !mechanismIds.has(effect.chainMechanismId)) issues.push(issue("error", "ENGINE_CARD_EFFECT_CHAIN_MISSING", `卡牌「${entry.name}」触发了不存在的连锁机制。`, `components.${component.id}.entries.${entry.id}.effects.${effectIndex}.chainMechanismId`));
      if (effect.timing && !BOARD_GAME_EFFECT_TIMINGS.has(effect.timing)) issues.push(issue("error", "ENGINE_CARD_EFFECT_TIMING_INVALID", `卡牌「${entry.name}」使用了不支持的效果时机「${effect.timing}」。`, `components.${component.id}.entries.${entry.id}.effects.${effectIndex}.timing`));
    });
  });
  (Array.isArray(design.mechanisms) ? design.mechanisms : []).forEach((mechanism, mechanismIndex) => {
    (mechanism.conditions || []).forEach((condition, conditionIndex) => {
      if (!variableIds.has(condition.sourceKey)) {
        issues.push(issue("error", "ENGINE_MECHANISM_CONDITION_VARIABLE_MISSING", `机制「${mechanism.name}」的条件引用了不存在的数值「${condition.sourceKey}」。`, `mechanisms.${mechanismIndex}.conditions.${conditionIndex}`));
      }
    });
    (mechanism.effects || []).forEach((effect, effectIndex) => {
      if (!variableIds.has(effect.targetKey)) {
        issues.push(issue("error", "ENGINE_MECHANISM_EFFECT_VARIABLE_MISSING", `机制「${mechanism.name}」的效果引用了不存在的数值「${effect.targetKey}」。`, `mechanisms.${mechanismIndex}.effects.${effectIndex}`));
      }
      (effect.conditions || []).forEach((condition, conditionIndex) => {
        if (!variableIds.has(condition.sourceKey)) issues.push(issue("error", "ENGINE_MECHANISM_EFFECT_CONDITION_VARIABLE_MISSING", `机制「${mechanism.name}」的效果条件引用了不存在的数值「${condition.sourceKey}」。`, `mechanisms.${mechanismIndex}.effects.${effectIndex}.conditions.${conditionIndex}`));
      });
      if (effect.chainMechanismId && !mechanismIds.has(effect.chainMechanismId)) issues.push(issue("error", "ENGINE_MECHANISM_EFFECT_CHAIN_MISSING", `机制「${mechanism.name}」触发了不存在的连锁机制。`, `mechanisms.${mechanismIndex}.effects.${effectIndex}.chainMechanismId`));
      if (effect.timing && !BOARD_GAME_EFFECT_TIMINGS.has(effect.timing)) issues.push(issue("error", "ENGINE_MECHANISM_EFFECT_TIMING_INVALID", `机制「${mechanism.name}」使用了不支持的效果时机「${effect.timing}」。`, `mechanisms.${mechanismIndex}.effects.${effectIndex}.timing`));
    });
  });
  if (engine.endCondition.type === "variable_threshold" && !variableIds.has(engine.endCondition.variableKey)) {
    issues.push(issue("error", "ENGINE_END_VARIABLE_MISSING", "试玩结束条件引用了不存在的数值。", "engine.endCondition.variableKey"));
  }
  engine.endConditions.forEach((condition, index) => {
    if (!variableIds.has(condition.variableKey)) issues.push(issue("error", "ENGINE_END_VARIABLE_MISSING", `额外结束条件引用了不存在的数值「${condition.variableKey}」。`, `engine.endConditions.${index}.variableKey`));
  });
  if (roleCount > 0 && engine.setup.startingNodeIds.length > 0 && engine.setup.startingNodeIds.length < Math.min(roleCount, 2)) {
    issues.push(issue("warning", "ENGINE_STARTS_REUSED", "起始区域少于席位数，多个席位会共用起点。", "engine.setup.startingNodeIds"));
  }
  const capabilities = assessBoardGameEngineCapabilities(engine);
  capabilities.checks.filter((item) => item.status !== "supported").forEach((item) => {
    issues.push(issue("error", `CAPABILITY_${item.status.toUpperCase()}`, `${item.label}：${item.note}`, `capabilities.${item.id}`));
  });
  const tests = [
    { id: "map-references", label: "区域与路线引用完整", passed: !issues.some((item) => ["ENGINE_ROUTE_NODE_MISSING", "ENGINE_ROUTE_SELF", "ENGINE_START_NODE_MISSING"].includes(item.code)) },
    { id: "phase-references", label: "阶段与行动引用完整", passed: !issues.some((item) => ["ENGINE_PHASE_ACTIONS_EMPTY", "ENGINE_PHASE_ACTION_MISSING", "ENGINE_ACTION_PHASE_MISSING"].includes(item.code)) },
    { id: "rule-references", label: "行动与数值规则引用完整", passed: !issues.some((item) => ["ENGINE_ACTION_MECHANISM_MISSING", "ENGINE_ACTION_VARIABLE_MISSING", "ENGINE_TRADE_VARIABLE_MISSING", "ENGINE_COMBAT_VARIABLE_MISSING", "ENGINE_PRODUCTION_VARIABLE_MISSING", "ENGINE_FACTION_MISSING", "ENGINE_END_VARIABLE_MISSING", "ENGINE_END_MULTIPLIER_VARIABLE_MISSING", "ENGINE_SCORE_VARIABLE_MISSING", "ENGINE_ROUND_EFFECT_VARIABLE_MISSING", "ENGINE_CARD_EFFECT_VARIABLE_MISSING", "ENGINE_CARD_EFFECT_CONDITION_VARIABLE_MISSING", "ENGINE_CARD_EFFECT_CHAIN_MISSING", "ENGINE_CARD_EFFECT_TIMING_INVALID", "ENGINE_MECHANISM_CONDITION_VARIABLE_MISSING", "ENGINE_MECHANISM_EFFECT_VARIABLE_MISSING", "ENGINE_MECHANISM_EFFECT_CONDITION_VARIABLE_MISSING", "ENGINE_MECHANISM_EFFECT_CHAIN_MISSING", "ENGINE_MECHANISM_EFFECT_TIMING_INVALID", "ENGINE_ACTION_TRACK_ACTION_MISSING"].includes(item.code)) },
    { id: "runtime-capabilities", label: "所需能力可在当前试玩运行", passed: capabilities.runnable }
  ];
  return { engine, issues, tests, capabilities, blocking: issues.some((item) => item.level === "error") };
}

function variableState(design, seatCount) {
  const values = {};
  const playerValues = Array.from({ length: seatCount }, () => ({}));
  for (const variable of Array.isArray(design.variables) ? design.variables : []) {
    if (variable.scope === "player") playerValues.forEach((state) => { state[variable.id] = variable.initialValue; });
    else values[variable.id] = variable.initialValue;
  }
  return { values, playerValues };
}

function revealPhaseDeck(engine, state, phase) {
  const deckId = phase?.deckId || "";
  const deck = deckId ? state.decks?.[deckId] : null;
  if (!Array.isArray(deck) || !deck.length) return null;
  const card = deck.pop();
  state.revealed.unshift(card);
  state.currentPhaseCard = card;
  return card;
}

function dealDraftHands(state, deckId, seatCount, handSize, age = 0) {
  const ageDecks = state.draftDecks?.[deckId];
  const source = Array.isArray(ageDecks) ? (ageDecks[age - 1] || []) : (state.decks?.[deckId] || []);
  state.hands = Array.from({ length: seatCount }, () => source.splice(Math.max(0, source.length - handSize), handSize).reverse());
}

export function boardGameEngineSignature(designValue) {
  const design = record(designValue);
  return JSON.stringify({ engine: normalizeBoardGameEngine(design.engine), variables: design.variables || [], mechanisms: design.mechanisms || [] });
}

export function createBoardGameRuntimeState(designValue, seatCountValue = 0) {
  const design = record(designValue);
  const engine = normalizeBoardGameEngine(design.engine);
  const seatCount = integer(seatCountValue || record(design.playerCount).min, 2, 1, 99);
  const variableValues = variableState(design, seatCount);
  engine.setup.playerInitialValues.slice(0, seatCount).forEach((initials, seatIndex) => {
    Object.entries(initials).forEach(([key, value]) => {
      const variable = (design.variables || []).find((item) => item.id === key && item.scope === "player");
      if (variable) variableValues.playerValues[seatIndex][key] = boundedVariableValue(variable, number(value, variable.initialValue));
    });
  });
  const starts = engine.setup.startingNodeIds.length ? engine.setup.startingNodeIds : engine.map.nodes.map((node) => node.id);
  const units = [];
  for (let seatIndex = 0; seatIndex < seatCount; seatIndex += 1) {
    for (let unitIndex = 0; unitIndex < engine.setup.unitsPerSeat; unitIndex += 1) {
      const nodeId = starts.length ? starts[(seatIndex + unitIndex) % starts.length] : "";
      units.push({ id: `unit-${seatIndex + 1}-${unitIndex + 1}`, seatIndex, nodeId });
    }
  }
  const owners = Object.fromEntries(engine.map.nodes.map((node) => [node.id, node.initialOwner >= 0 && node.initialOwner < seatCount ? node.initialOwner : null]));
  const state = {
    signature: boardGameEngineSignature(design),
    round: 1,
    phaseIndex: 0,
    activeSeatIndex: 0,
    seatCount,
    teamAssignments: Array.from({ length: seatCount }, (_, seatIndex) => engine.setup.teamAssignments[seatIndex] || `team-${seatIndex + 1}`),
    seed: engine.setup.seed,
    randomState: engine.setup.seed,
    values: variableValues.values,
    playerValues: variableValues.playerValues,
    scores: Array.from({ length: seatCount }, () => 0),
    units,
    owners,
    decks: {},
    draftDecks: {},
    hands: Array.from({ length: seatCount }, () => []),
    claimedCards: Array.from({ length: seatCount }, () => []),
    market: [],
    draftAge: 1,
    draftTurn: 1,
    draftDirection: engine.setup.draftPassDirections[0] || "right",
    routeOwners: {},
    riskProgress: Array.from({ length: seatCount }, () => 0),
    dice: [],
    continueSeatIndex: null,
    revealed: [],
    privateRevealed: Array.from({ length: seatCount }, () => []),
    teamRevealed: {},
    submissions: {},
    resolved: false,
    ended: false,
    sequence: 1,
    responseSequence: 0,
    responseEvents: [],
    effectQueue: [],
    pendingResponseWindow: null,
    ...createBoardGameAdvancedState(seatCount),
    lastMove: null,
    log: [{ id: "engine-log-1", tone: "system", text: "试玩状态已由引擎数据建立，等待明确操作。" }]
  };
  for (const [index, rule] of engine.setup.factionRules.entries()) {
    const seatIndex = Number.isInteger(rule.startingSeat) ? rule.startingSeat : index;
    if (seatIndex >= 0 && seatIndex < seatCount) {
      state.factionState[seatIndex] = { id: rule.id, flags: clone(rule.flags), counters: clone(rule.counters), blockedActionIds: [...rule.blockedActionIds] };
      for (const [key, value] of Object.entries(rule.initialValues)) {
        if ((design.variables || []).some((variable) => variable.id === key)) setVariableValue(design, state, seatIndex, key, number(value, 0));
      }
    }
  }
  engine.setup.hiddenObjectives.forEach((objective, index) => {
    const seatIndex = index % seatCount;
    state.hiddenObjectives[seatIndex].push({ ...clone(objective), completed: false });
    state.objectiveResults[seatIndex].push({ id: objective.id, completed: false, points: objective.points });
  });
  for (const component of Array.isArray(design.components) ? design.components : []) {
    if (component.type !== "deck") continue;
    const cards = [];
    for (const entry of component.entries || []) {
      for (let index = 0; index < Math.max(1, integer(entry.quantity, 1, 1, 999)); index += 1) {
        cards.push({
          id: `${component.id}:${entry.id}:${index + 1}`,
          componentId: component.id,
          deckId: component.id,
          entryId: entry.id,
          name: entry.name,
          description: entry.description,
          age: entry.age || 0,
          tags: Array.isArray(entry.tags) ? [...entry.tags] : [],
          effects: Array.isArray(entry.effects) ? clone(entry.effects) : [],
          triggers: Array.isArray(entry.triggers) ? clone(entry.triggers) : [],
          continuousEffects: Array.isArray(entry.continuousEffects) ? clone(entry.continuousEffects) : []
        });
      }
    }
    state.decks[component.id] = shuffled(cards, state);
  }
  const personalDeckIds = [...new Set(engine.actions.filter((action) => action.deckScope === "personal" && action.deckId).map((action) => action.deckId))];
  for (const deckId of personalDeckIds) {
    const config = engine.setup.personalDecks.find((item) => item.deckId === deckId) || { deckId, entryIds: [], initialHandSize: 0, cardLimit: 999 };
    const sourceCards = (state.decks[deckId] || []).filter((card) => !config.entryIds.length || config.entryIds.includes(card.entryId)).slice(0, config.cardLimit);
    for (let seatIndex = 0; seatIndex < seatCount; seatIndex += 1) {
      const personalCards = sourceCards.map((card, cardIndex) => ({ ...clone(card), id: `${card.id}:seat-${seatIndex + 1}:${cardIndex + 1}`, personalOwner: seatIndex }));
      state.personalDecks[seatIndex][deckId] = shuffled(personalCards, state);
      const initialHand = Math.min(config.initialHandSize, state.personalDecks[seatIndex][deckId].length);
      if (initialHand > 0) state.hands[seatIndex].push(...state.personalDecks[seatIndex][deckId].splice(-initialHand));
      if ((design.variables || []).some((variable) => variable.id === "hand" && variable.scope === "player")) setVariableValue(design, state, seatIndex, "hand", state.hands[seatIndex].length);
    }
  }
  const draftAction = engine.actions.find((action) => action.kind === "draft" && action.deckId);
  if (draftAction) {
    const deck = state.decks[draftAction.deckId] || [];
    if (draftAction.draftMode === "hand") {
      state.draftMode = "hand";
      const ageCount = engine.setup.draftAgeCount;
      const cardsByAge = Array.from({ length: ageCount }, () => []);
      deck.forEach((card) => {
        const age = integer(card.age, 0, 0, ageCount);
        cardsByAge[Math.max(0, Math.min(ageCount - 1, age ? age - 1 : 0))].push(card);
      });
      state.draftDecks[draftAction.deckId] = cardsByAge;
      state.decks[draftAction.deckId] = [];
      dealDraftHands(state, draftAction.deckId, seatCount, engine.setup.handSize, 1);
    } else {
      state.market = deck.splice(Math.max(0, deck.length - engine.setup.marketSize), engine.setup.marketSize).reverse();
    }
  }
  const openingCard = revealPhaseDeck(engine, state, engine.phases[0]);
  if (openingCard?.name) addLog(state, `公开当前牌面「${openingCard.name}」。`, "event");
  return state;
}

function addLog(state, textValue, tone = "system") {
  state.sequence = integer(state.sequence, 0, 0, 1_000_000) + 1;
  state.log.unshift({ id: `engine-log-${state.sequence}`, tone, text: text(textValue, 1200) });
  state.log = state.log.slice(0, 30);
}

function recordResponse(state, response = {}) {
  if (!Array.isArray(state.responseEvents)) state.responseEvents = [];
  state.responseSequence = integer(state.responseSequence, 0, 0, 1_000_000) + 1;
  state.responseEvents.unshift({
    id: `response-${state.responseSequence}`,
    sourceType: text(response.sourceType, 40) || "effect",
    sourceId: text(response.sourceId, 120),
    sourceLabel: text(response.sourceLabel, 160),
    seatIndex: Number.isInteger(response.seatIndex) ? response.seatIndex : null,
    targetScope: text(response.targetScope, 40) || "self",
    targetSeatIndex: Number.isInteger(response.targetSeatIndex) ? response.targetSeatIndex : null,
    targetKey: text(response.targetKey, 120),
    operation: text(response.operation, 40),
    before: response.before,
    after: response.after,
    visibility: ["private", "team"].includes(response.visibility) ? response.visibility : "public",
    status: ["applied", "queued", "skipped"].includes(response.status) ? response.status : (response.applied === false ? "skipped" : "applied"),
    applied: response.applied !== false,
    reason: text(response.reason, 240),
    detail: text(response.detail, 500)
  });
  state.responseEvents = state.responseEvents.slice(0, 100);
}

function responseDetail(effect, before, after, applied = true) {
  if (!applied) return `${effect.targetKey} 未生效${effect.value ? `（${effect.value}）` : ""}`;
  return `${effect.targetKey} ${effect.operation} ${effect.value}（${String(before)} → ${String(after)}）`;
}

function currentPhase(engine, state) {
  return engine.phases[state.phaseIndex] || engine.phases[0] || null;
}

function actionFor(engine, actionId) {
  return engine.actions.find((item) => item.id === actionId) || null;
}

function actionTrackJump(engine, state, action, seatIndex) {
  const track = engine.setup.actionTrack;
  if (!track?.enabled) return { enabled: false, cost: 0, targetIndex: -1, steps: 0 };
  const phase = currentPhase(engine, state);
  const ids = track.actionIds.length ? track.actionIds : (phase?.actionIds || []);
  const targetIndex = ids.indexOf(action.id);
  if (targetIndex < 0 || !ids.length) return { enabled: true, cost: 0, targetIndex: -1, steps: 0 };
  const currentIndex = Number.isInteger(state.actionTrack?.[seatIndex]) ? state.actionTrack[seatIndex] % ids.length : 0;
  const forward = targetIndex >= currentIndex ? targetIndex - currentIndex : (track.wrapAround ? ids.length - currentIndex + targetIndex : Number.POSITIVE_INFINITY);
  const steps = Number.isFinite(forward) ? forward : 0;
  return {
    enabled: true,
    cost: Math.max(0, steps - 1) * number(track.jumpCostPerStep, 1),
    targetIndex,
    steps,
    resourceKey: track.jumpResourceKey
  };
}

function scopedState(design, state, seatIndex) {
  const combined = { ...state.values, ...(state.playerValues[seatIndex] || {}) };
  return {
    combined,
    write(next) {
      for (const variable of Array.isArray(design.variables) ? design.variables : []) {
        if (!(variable.id in next)) continue;
        if (variable.scope === "player") state.playerValues[seatIndex][variable.id] = next[variable.id];
        else state.values[variable.id] = next[variable.id];
      }
    }
  };
}

function comparable(value) {
  const numeric = Number(value);
  return String(value ?? "").trim() !== "" && Number.isFinite(numeric) ? numeric : String(value ?? "");
}

function evaluateCondition(condition, values) {
  const left = comparable(values[condition.sourceKey]);
  const right = comparable(condition.value);
  if (condition.operator === "eq") return left === right;
  if (condition.operator === "neq") return left !== right;
  if (condition.operator === "gt") return left > right;
  if (condition.operator === "gte") return left >= right;
  if (condition.operator === "lt") return left < right;
  if (condition.operator === "lte") return left <= right;
  if (condition.operator === "contains") return String(left).includes(String(right));
  return false;
}

function boundedVariableValue(variable, value) {
  if (!variable || typeof value !== "number") return value;
  return Math.max(number(variable.min, -1_000_000_000), Math.min(number(variable.max, 1_000_000_000), value));
}

function applyEffect(effect, values, design) {
  const current = values[effect.targetKey];
  const operand = comparable(effect.value);
  let next = current;
  if (effect.operation === "set") next = operand;
  else if (effect.operation === "add") next = number(current) + number(operand);
  else if (effect.operation === "subtract") next = number(current) - number(operand);
  else if (effect.operation === "multiply") next = number(current) * number(operand, 1);
  else if (effect.operation === "min") next = Math.min(number(current), number(operand));
  else if (effect.operation === "max") next = Math.max(number(current), number(operand));
  else if (effect.operation === "toggle") next = !Boolean(current);
  return boundedVariableValue((design.variables || []).find((item) => item.id === effect.targetKey), next);
}

function effectScope(effect, defaultScope = "self") {
  const declared = BOARD_GAME_EFFECT_SCOPES.has(effect?.scope) ? effect.scope : "auto";
  return declared === "auto" ? defaultScope : declared;
}

function effectTargets(design, state, seatIndex, effect, defaultScope = "self", targetSeatIndex = seatIndex) {
  const variable = (design.variables || []).find((item) => item.id === effect.targetKey);
  if (!variable) return [];
  const scope = effectScope(effect, defaultScope);
  if (variable.scope !== "player") return [{ scope: "global", seatIndex: null }];
  if (scope === "global") return [];
  if (scope === "all_players") return Array.from({ length: state.seatCount }, (_, index) => ({ scope, seatIndex: index }));
  if (scope === "target_player") return [{ scope, seatIndex: targetSeatIndex }];
  return [{ scope: "self", seatIndex }];
}

function effectConditions(effect) {
  if (Array.isArray(effect?.conditions)) return effect.conditions;
  return effect?.condition && typeof effect.condition === "object" ? [effect.condition] : [];
}

function effectConditionPassed(design, state, targetSeatIndex, effect) {
  const conditions = effectConditions(effect);
  if (!conditions.length) return true;
  const values = targetSeatIndex === null || targetSeatIndex === undefined
    ? state.values
    : { ...state.values, ...(state.playerValues[targetSeatIndex] || {}) };
  const results = conditions.map((condition) => evaluateCondition(condition, values));
  return effect.conditionMode === "any" ? results.some(Boolean) : results.every(Boolean);
}

function queueEffect(state, effect, context) {
  if (!Array.isArray(state.effectQueue)) state.effectQueue = [];
  state.effectQueue.push({ effect: clone(effect), ...context });
  recordResponse(state, {
    ...context,
    targetKey: effect.targetKey,
    operation: effect.operation,
    visibility: context.visibility,
    status: "queued",
    applied: false,
    reason: `等待${effect.timing === "round_end" ? "轮次结束" : "当前行动结算"}。`,
    detail: `${effect.targetKey} ${effect.operation} ${effect.value}（已排队）`
  });
  return [{ applied: false, status: "queued", detail: `${effect.targetKey} ${effect.operation} ${effect.value}（已排队）` }];
}

function applyScopedEffect(design, state, seatIndex, effect, { sourceType = "effect", sourceId = "", sourceLabel = "", defaultScope = "self", targetSeatIndex = seatIndex, visibility = "public", allowQueue = true, chainDepth = 0 } = {}) {
  const context = { sourceType, sourceId, sourceLabel, seatIndex, visibility, defaultScope, targetSeatIndex };
  if (allowQueue && effect.timing && effect.timing !== "immediate") return queueEffect(state, effect, context);
  const variable = (design.variables || []).find((item) => item.id === effect.targetKey);
  const scope = effectScope(effect, defaultScope);
  if (!variable) {
    recordResponse(state, { sourceType, sourceId, sourceLabel, seatIndex, targetScope: scope, targetKey: effect.targetKey, operation: effect.operation, visibility, applied: false, reason: "目标数值不存在。", detail: responseDetail(effect, undefined, undefined, false) });
    return [{ applied: false, detail: responseDetail(effect, undefined, undefined, false) }];
  }
  const targets = effectTargets(design, state, seatIndex, effect, defaultScope, targetSeatIndex);
  if (!targets.length) {
    recordResponse(state, { sourceType, sourceId, sourceLabel, seatIndex, targetScope: scope, targetKey: effect.targetKey, operation: effect.operation, visibility, applied: false, reason: `作用域「${scope}」不能写入席位数值。`, detail: responseDetail(effect, undefined, undefined, false) });
    return [{ applied: false, detail: responseDetail(effect, undefined, undefined, false) }];
  }
  const changes = targets.flatMap((target) => {
    if (!effectConditionPassed(design, state, target.seatIndex, effect)) {
      const detail = `${effect.targetKey} 条件未满足`;
      recordResponse(state, { sourceType, sourceId, sourceLabel, seatIndex, targetScope: scope, targetSeatIndex: target.seatIndex, targetKey: effect.targetKey, operation: effect.operation, visibility, applied: false, reason: "效果条件未满足。", detail });
      return [{ applied: false, status: "skipped", targetSeatIndex: target.seatIndex, detail }];
    }
    return Array.from({ length: integer(effect.repeat, 1, 1, 20) }, () => {
    const values = target.scope === "global" ? state.values : (state.playerValues[target.seatIndex] || (state.playerValues[target.seatIndex] = {}));
    const before = values[effect.targetKey];
    const after = applyEffect(effect, values, design);
    values[effect.targetKey] = after;
    const detail = responseDetail(effect, before, after);
    recordResponse(state, { sourceType, sourceId, sourceLabel, seatIndex, targetScope: scope, targetSeatIndex: target.seatIndex, targetKey: effect.targetKey, operation: effect.operation, visibility, before, after, applied: true, detail });
    return { applied: true, targetSeatIndex: target.seatIndex, before, after, detail };
    });
  });
  if (effect.chainMechanismId && changes.some((change) => change.applied) && chainDepth < 8) {
    const chained = executeMechanism(design, state, seatIndex, effect.chainMechanismId, {
      defaultScope,
      targetSeatIndex,
      chainDepth: chainDepth + 1
    });
    if (chained.detail) changes.push({ applied: chained.ok, detail: chained.detail });
  }
  return changes;
}

function flushBoardGameEffectQueue(design, state, timing) {
  const queue = Array.isArray(state.effectQueue) ? state.effectQueue : [];
  const due = queue.filter((item) => item.effect?.timing === timing).sort((left, right) => integer(left.effect?.priority, 0, -100, 100) - integer(right.effect?.priority, 0, -100, 100));
  state.effectQueue = queue.filter((item) => item.effect?.timing !== timing);
  return due.flatMap((item) => applyScopedEffect(design, state, item.seatIndex, item.effect, {
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    sourceLabel: item.sourceLabel,
    defaultScope: item.defaultScope,
    targetSeatIndex: item.targetSeatIndex,
    visibility: item.visibility,
    allowQueue: false
  }));
}

function executeMechanism(design, state, seatIndex, mechanismId, options = {}) {
  const mechanism = (design.mechanisms || []).find((item) => item.id === mechanismId);
  if (!mechanism) return { ok: true, detail: "未绑定额外条件效果" };
  const scoped = scopedState(design, state, seatIndex);
  const results = (mechanism.conditions || []).map((condition) => evaluateCondition(condition, scoped.combined));
  const passed = results.length === 0 || (mechanism.conditionMode === "any" ? results.some(Boolean) : results.every(Boolean));
  if (!passed) return { ok: false, code: "MECHANISM_CONDITION_BLOCKED", message: `「${mechanism.name}」的执行条件未成立。` };
  const changes = (mechanism.effects || []).flatMap((effect) => applyScopedEffect(design, state, seatIndex, effect, {
    sourceType: "mechanism",
    sourceId: mechanism.id,
    sourceLabel: mechanism.name,
    defaultScope: options.defaultScope || "self",
    targetSeatIndex: options.targetSeatIndex ?? seatIndex,
    chainDepth: options.chainDepth || 0
  }));
  const applied = changes.filter((change) => change.applied);
  return {
    ok: true,
    changes,
    detail: `已执行「${mechanism.name}」${applied.length ? `：${applied.map((change) => change.detail).join("；")}` : "（没有实际数值变化）"}`
  };
}

function variableValue(design, state, seatIndex, key) {
  const variable = (design.variables || []).find((item) => item.id === key);
  return variable?.scope === "player" ? state.playerValues[seatIndex]?.[key] : state.values[key];
}

function setVariableValue(design, state, seatIndex, key, value) {
  const variable = (design.variables || []).find((item) => item.id === key);
  const next = boundedVariableValue(variable, value);
  if (variable?.scope === "player") state.playerValues[seatIndex][key] = next;
  else state.values[key] = next;
}

function applyCardEffects(design, state, seatIndex, card, { visibility = "public" } = {}) {
  const effects = Array.isArray(card?.effects) ? card.effects : [];
  if (!effects.length) return [];
  const details = [];
  for (const effect of effects) {
    const changes = applyScopedEffect(design, state, seatIndex, effect, {
      sourceType: "card",
      sourceId: card.id,
      sourceLabel: card.name,
      defaultScope: "self",
      visibility
    });
    details.push(...changes.map((change) => change.detail));
  }
  return details;
}

function applyTableauTriggers(design, state, seatIndex, eventName) {
  const tableau = Array.isArray(state.tableaus?.[seatIndex]) ? state.tableaus[seatIndex] : [];
  const details = [];
  for (const card of tableau) {
    const triggers = Array.isArray(card?.triggers) ? card.triggers : [];
    const triggerEntries = [
      ...triggers.map((trigger) => ({ ...trigger, sourceType: "tableau_trigger" })),
      ...(eventName === "round_end" ? [{ id: "continuous-round-end", event: "round_end", effects: card?.continuousEffects || [], sourceType: "tableau_continuous" }] : [])
    ];
    for (const trigger of triggerEntries) {
      const triggerEvent = text(trigger?.event, 80);
      if (!triggerEvent || (triggerEvent !== eventName && triggerEvent !== "action:*" && !(eventName.startsWith("action:") && triggerEvent === "action:any"))) continue;
      const effects = Array.isArray(trigger.effects) ? trigger.effects : [];
      for (const effect of effects) {
        const changes = applyScopedEffect(design, state, seatIndex, effect, {
          sourceType: trigger.sourceType || "tableau_trigger",
          sourceId: card.id,
          sourceLabel: card.name || card.id,
          defaultScope: "self",
          visibility: "public"
        });
        details.push(...changes.map((change) => change.detail));
        state.triggerLog.unshift({ cardId: card.id, seatIndex, event: eventName, effectId: effect.id || "", sourceType: trigger.sourceType || "tableau_trigger", detail: changes.map((change) => change.detail).join("；") });
      }
    }
  }
  state.triggerLog = state.triggerLog.slice(0, 200);
  return details;
}

function unitForSeat(state, seatIndex) {
  return state.units.find((unit) => unit.seatIndex === seatIndex) || null;
}

function deckIdForAction(state, action) {
  return action.deckId || Object.keys(state.decks || {})[0] || "";
}

function deckForAction(state, action, seatIndex) {
  const deckId = deckIdForAction(state, action);
  if (action.deckScope === "personal") return state.personalDecks?.[seatIndex]?.[deckId] || null;
  return state.decks?.[deckId] || null;
}

function discardCountForAction(state, action, seatIndex) {
  const deckId = deckIdForAction(state, action);
  if (action.deckScope === "personal") return state.personalDiscardPiles?.[seatIndex]?.[deckId]?.length || 0;
  return state.discardPiles?.[deckId]?.length || 0;
}

export function legalBoardGameTargets(designValue, stateValue, actionId, seatIndexValue = null) {
  const design = record(designValue);
  const engine = normalizeBoardGameEngine(design.engine);
  const state = record(stateValue);
  const action = actionFor(engine, actionId);
  const seatIndex = seatIndexValue === null ? integer(state.activeSeatIndex, 0, 0, 98) : integer(seatIndexValue, 0, 0, 98);
  if (!action) return [];
  if (action.target === "none") return [""];
  if (action.target === "any_region") {
    const nodes = engine.map.nodes.filter((node) => !action.targetTerrain || node.terrain === action.targetTerrain).map((node) => node.id);
    return action.kind === "place" ? nodes.filter((nodeId) => !state.units.some((unit) => unit.nodeId === nodeId)) : nodes;
  }
  if (action.target === "unowned_region") return engine.map.nodes.filter((node) => !Number.isInteger(state.owners?.[node.id])).map((node) => node.id);
  if (action.target === "own_region") return engine.map.nodes.filter((node) => state.owners?.[node.id] === seatIndex).map((node) => node.id);
  if (action.target === "opponent_region") return engine.map.nodes.filter((node) => Number.isInteger(state.owners?.[node.id]) && state.owners[node.id] !== seatIndex).map((node) => node.id);
  if (action.target === "any_route") return engine.map.edges.filter((edge) => !Number.isInteger(state.routeOwners?.[edge.id]) && !edge.blocked).map((edge) => edge.id);
  if (action.target === "opponent_seat") return Array.from({ length: state.seatCount }, (_, index) => String(index)).filter((index) => Number(index) !== seatIndex);
  if (action.target === "market_card") return (Array.isArray(state.market) ? state.market : []).map((card) => card.id);
  if (action.target === "empty_tile") return engine.map.nodes.map((node) => node.id).filter((nodeId) => !state.tilePlacements?.[nodeId]);
  if (action.target === "trade_offer") return (state.tradeOffers || []).filter((offer) => offer.status === "pending" && (action.kind === "trade_confirm" ? offer.toSeat === seatIndex : [offer.fromSeat, offer.toSeat].includes(seatIndex))).map((offer) => offer.id);
  const origin = unitForSeat(state, seatIndex)?.nodeId;
  if (!origin) return [];
  const targets = new Set();
  for (const edge of engine.map.edges) {
    if (edge.blocked) continue;
    if (edge.from === origin) targets.add(edge.to);
    if (edge.bidirectional && edge.to === origin) targets.add(edge.from);
  }
  return [...targets];
}

function validateAction(design, engine, state, action, targetId, seatIndex, bidAmountValue = 0, cardId = "") {
  const phase = currentPhase(engine, state);
  if (!phase || !phase.actionIds.includes(action.id) || action.phaseId !== phase.id) return { ok: false, code: "ACTION_NOT_IN_PHASE", message: "该行动不属于当前阶段。" };
  if (seatIndex !== state.activeSeatIndex) return { ok: false, code: "SEAT_NOT_ACTIVE", message: "当前不是该席位的提交顺序。" };
  if (action.factionId && state.factionState?.[seatIndex]?.id !== action.factionId) return { ok: false, code: "FACTION_ACTION_LOCKED", message: "当前席位的派系不能执行这个行动。" };
  if (state.factionState?.[seatIndex]?.blockedActionIds?.includes(action.id)) return { ok: false, code: "FACTION_ACTION_BLOCKED", message: "当前派系禁止执行这个行动。" };
  if (state.resolved || state.ended) return { ok: false, code: "PHASE_RESOLVED", message: "当前阶段已经结算。" };
  if (number(state.actionCooldowns?.[seatIndex]?.[action.id], 0) > 0) return { ok: false, code: "ACTION_COOLDOWN", message: `该行动还需等待 ${state.actionCooldowns[seatIndex][action.id]} 个回合。` };
  const trackJump = actionTrackJump(engine, state, action, seatIndex);
  if (trackJump.cost > 0 && (!trackJump.resourceKey || number(variableValue(design, state, seatIndex, trackJump.resourceKey), 0) < trackJump.cost)) {
    return { ok: false, code: "ACTION_TRACK_JUMP_RESOURCE", message: `行动轨道跳跃需要 ${trackJump.cost} ${trackJump.resourceKey || "资源"}。` };
  }
  const legalTargets = legalBoardGameTargets(design, state, action.id, seatIndex);
  if (action.target !== "none" && !legalTargets.includes(targetId)) return { ok: false, code: "TARGET_ILLEGAL", message: "所选区域不是该行动的合法目标。" };
  if (action.cost > 0 && number(variableValue(design, state, seatIndex, action.resourceKey), 0) < action.cost) return { ok: false, code: "RESOURCE_NOT_ENOUGH", message: "资源不足，不能执行该行动。" };
  if (action.kind === "pay" && number(variableValue(design, state, seatIndex, action.resourceKey), 0) < Math.abs(action.amount || 1)) return { ok: false, code: "RESOURCE_NOT_ENOUGH", message: "资源不足，不能支付该数值。" };
  if (["draw", "play"].includes(action.kind) && number(variableValue(design, state, seatIndex, action.resourceKey), 0) < Math.abs(action.amount || 1)) return { ok: false, code: "RESOURCE_NOT_ENOUGH", message: "资源不足，不能执行该牌面行动。" };
  if (action.kind === "draw") {
    const deck = deckForAction(state, action, seatIndex);
    const discardCount = discardCountForAction(state, action, seatIndex);
    if (Array.isArray(deck) && deck.length + (action.reshuffleOnEmpty ? discardCount : 0) < Math.abs(action.amount || 1)) return { ok: false, code: "DECK_EMPTY", message: "牌库与弃牌堆中的牌不足，不能继续抽取。" };
    const handVariable = (design.variables || []).find((variable) => variable.id === "hand" && variable.scope === "player");
    if (handVariable && number(variableValue(design, state, seatIndex, "hand"), 0) + Math.abs(action.amount || 1) > number(handVariable.max, 999)) return { ok: false, code: "HAND_LIMIT", message: "手牌已达到上限。" };
  }
  if (action.kind === "play" && Array.isArray(state.hands?.[seatIndex]) && state.hands[seatIndex].length < Math.abs(action.amount || 1)) return { ok: false, code: "HAND_EMPTY", message: "当前席位没有足够的实际手牌。" };
  if (action.kind === "bid") {
    const bidAmount = integer(bidAmountValue, 0, 0, 999999);
    if (bidAmount < 0) return { ok: false, code: "BID_INVALID", message: "出价不能小于 0。" };
    if (number(variableValue(design, state, seatIndex, action.resourceKey), 0) < bidAmount) return { ok: false, code: "BID_TOO_HIGH", message: "出价不能超过当前拥有的资源。" };
  }
  if (action.kind === "draft") {
    if (action.draftMode === "hand") {
      if (!state.hands?.[seatIndex]?.some((card) => card.id === cardId)) return { ok: false, code: "CARD_NOT_IN_HAND", message: "请选择当前席位手中仍存在的卡牌。" };
    } else if (!state.market?.some((card) => card.id === cardId)) {
      return { ok: false, code: "CARD_NOT_IN_MARKET", message: "请选择公共市场中仍存在的卡牌。" };
    }
  }
  if (["discard", "trash"].includes(action.kind)) {
    const hand = Array.isArray(state.hands?.[seatIndex]) ? state.hands[seatIndex] : [];
    if (!hand.length) return { ok: false, code: "HAND_EMPTY", message: "当前席位没有可以处理的手牌。" };
    if (cardId && !hand.some((card) => card.id === cardId)) return { ok: false, code: "CARD_NOT_IN_HAND", message: "指定卡牌不在当前席位手牌中。" };
  }
  if (action.kind === "trade") {
    const toSeat = Number(targetId);
    if (!Number.isInteger(toSeat) || toSeat < 0 || toSeat >= state.seatCount || toSeat === seatIndex) return { ok: false, code: "TRADE_TARGET_INVALID", message: "交易对象必须是另一名有效席位。" };
    const fromValue = number(variableValue(design, state, seatIndex, action.tradeGiveKey), 0);
    const toValue = number(variableValue(design, state, toSeat, action.tradeReceiveKey), 0);
    if (fromValue < action.tradeGiveAmount || toValue < action.tradeReceiveAmount) return { ok: false, code: "TRADE_RESOURCE_NOT_ENOUGH", message: "交易双方资源不足。" };
  }
  if (action.kind === "trade_offer") {
    const toSeat = Number(targetId);
    if (!Number.isInteger(toSeat) || toSeat < 0 || toSeat >= state.seatCount || toSeat === seatIndex) return { ok: false, code: "TRADE_TARGET_INVALID", message: "交易对象必须是另一名有效席位。" };
    if (number(variableValue(design, state, seatIndex, action.tradeGiveKey), 0) < action.tradeGiveAmount) return { ok: false, code: "TRADE_RESOURCE_NOT_ENOUGH", message: "发起交易时资源不足。" };
  }
  if (["trade_confirm", "trade_cancel"].includes(action.kind) && !legalTargets.includes(targetId)) return { ok: false, code: "TRADE_OFFER_ILLEGAL", message: "当前没有可以处理的交易报价。" };
  if (action.kind === "contribute" && number(variableValue(design, state, seatIndex, action.resourceKey), 0) < Math.max(1, action.amount || 1)) return { ok: false, code: "CONTRIBUTION_RESOURCE_NOT_ENOUGH", message: "投入公共危机池所需资源不足。" };
  if (action.kind === "market_buy") {
    const marketCard = state.market?.find((card) => card.id === targetId);
    if (!marketCard) return { ok: false, code: "CARD_NOT_IN_MARKET", message: "目标卡牌不在公共市场。" };
    const price = number(marketCard.price ?? marketCard.cost, 0);
    if (number(variableValue(design, state, seatIndex, action.resourceKey), 0) < price) return { ok: false, code: "RESOURCE_NOT_ENOUGH", message: "资源不足，不能购买市场卡牌。" };
  }
  if (action.kind === "combat") {
    const defender = Number(targetId);
    if (!Number.isInteger(defender) || defender < 0 || defender >= state.seatCount || defender === seatIndex) return { ok: false, code: "COMBAT_TARGET_INVALID", message: "战斗目标必须是另一名有效席位。" };
  }
  if (action.kind === "claim_route") {
    const route = engine.map.edges.find((edge) => edge.id === targetId);
    const routeCost = Math.max(1, number(route?.cost, 1));
    if (number(variableValue(design, state, seatIndex, action.resourceKey), 0) < routeCost) return { ok: false, code: "RESOURCE_NOT_ENOUGH", message: "资源不足，不能占领这条路线。" };
  }
  return { ok: true, trackJump };
}

function responseWindowEligibleSeats(state, action, submission) {
  if (action.responseSeatMode === "target_player") {
    const targetSeat = Number(submission.targetId);
    return Number.isInteger(targetSeat) && targetSeat >= 0 && targetSeat < state.seatCount && targetSeat !== submission.seatIndex
      ? [targetSeat]
      : [];
  }
  if (action.responseSeatMode === "all_players") return Array.from({ length: state.seatCount }, (_, index) => index);
  return Array.from({ length: state.seatCount }, (_, index) => index).filter((index) => index !== submission.seatIndex);
}

function openBoardGameResponseWindow(engine, state, action, submission) {
  if (!action.responseActionIds.length) return null;
  if ((state.responseStack?.length || 0) >= 3) return null;
  const eligibleSeatIndexes = responseWindowEligibleSeats(state, action, submission);
  if (!eligibleSeatIndexes.length) return null;
  const openedAt = Date.now();
  const timeoutSeconds = integer(action.responseTimeoutSeconds || engine.setup.responseTimeoutSeconds, 15, 1, 3600);
  state.pendingResponseWindow = {
    id: `response-window-${state.round}-${state.sequence || 1}-${state.responseSequence || 0}`,
    sourceActionId: action.id,
    sourceSeatIndex: submission.seatIndex,
    targetId: submission.targetId,
    actionIds: [...action.responseActionIds],
    eligibleSeatIndexes,
    submissions: {},
    openedAt,
    deadlineAt: openedAt + timeoutSeconds * 1000,
    timeoutSeconds,
    defaultActionId: action.responseDefaultActionId || "",
    depth: state.pendingResponseWindow ? (state.responseStack?.length || 0) + 1 : 0
  };
  state.activeSeatIndex = eligibleSeatIndexes[0];
  state.resolved = false;
  addLog(state, `行动「${action.label}」开启反应窗口，等待席位 ${eligibleSeatIndexes.map((index) => index + 1).join("、")} 在 ${timeoutSeconds} 秒内响应。`, "response");
  return state.pendingResponseWindow;
}

function responseWindowSummary(window, timedOut = false) {
  const status = timedOut ? "超时自动放弃" : "已提交响应";
  return `反应窗口${status}（${window.actionIds.join("、")}）`;
}

function settleResponseWindowOrResumeParent(state, completedWindow, detail, timedOut = false) {
  let currentWindow = completedWindow;
  let currentDetail = detail;
  while (true) {
    const frame = Array.isArray(state.responseStack) && state.responseStack.length ? state.responseStack.pop() : null;
    if (!frame) {
      state.pendingResponseWindow = null;
      state.activeSeatIndex = currentWindow.sourceSeatIndex;
      state.resolved = true;
      addLog(state, `${currentDetail}。`, timedOut ? "timeout" : "resolution");
      return { ok: true, state, detail: currentDetail, phaseResolved: true };
    }
    const parent = clone(frame.window);
    parent.submissions = { ...(parent.submissions || {}) };
    parent.submissions[String(frame.seatIndex)] = {
      seatIndex: frame.seatIndex,
      actionId: frame.actionId,
      targetId: frame.targetId,
      cardId: frame.cardId,
      bidAmount: frame.bidAmount,
      status: "submitted",
      nested: true
    };
    const nextSeat = parent.eligibleSeatIndexes.find((candidate) => !parent.submissions[String(candidate)]);
    if (nextSeat !== undefined) {
      state.pendingResponseWindow = parent;
      state.activeSeatIndex = nextSeat;
      state.resolved = false;
      addLog(state, `${currentDetail}；嵌套反应完成，继续等待席位 ${nextSeat + 1}。`, "response");
      return { ok: true, state, detail: `${currentDetail}；继续处理外层反应。`, phaseResolved: false };
    }
    currentWindow = parent;
    currentDetail = `${currentDetail}；${responseWindowSummary(parent)}`;
  }
}

function applyPendingResponseAction(design, engine, state, input) {
  const window = state.pendingResponseWindow;
  if (!window) return { ok: false, code: "RESPONSE_WINDOW_NONE", message: "当前没有待处理的反应窗口。" };
  const seatIndex = integer(input.seatIndex, 0, 0, Math.max(0, state.seatCount - 1));
  if (!window.eligibleSeatIndexes.includes(seatIndex)) return { ok: false, code: "RESPONSE_SEAT_INELIGIBLE", message: "当前席位不在本次反应窗口中。" };
  if (window.submissions?.[String(seatIndex)]) return { ok: false, code: "RESPONSE_ALREADY_SUBMITTED", message: "该席位已经提交过反应。" };
  if (!window.actionIds.includes(input.actionId)) return { ok: false, code: "RESPONSE_ACTION_ILLEGAL", message: "该行动不是本反应窗口允许的响应。" };
  if (state.activeSeatIndex !== seatIndex) return { ok: false, code: "SEAT_NOT_ACTIVE", message: "请等待前一名席位完成反应。" };
  const action = actionFor(engine, input.actionId);
  if (!action) return { ok: false, code: "ACTION_MISSING", message: "反应行动不存在。" };
  const targetId = text(input.targetId, 80);
  const cardId = text(input.cardId, 160);
  const validation = validateAction(design, engine, state, action, targetId, seatIndex, integer(input.bidAmount, 0, 0, 999999), cardId);
  if (!validation.ok) return validation;
  const parentWindow = clone(window);
  const bidAmount = integer(input.bidAmount, 0, 0, 999999);
  const result = applySingleAction(design, engine, state, { seatIndex, actionId: action.id, targetId, cardId, bidAmount }, { allowResponseWindow: true });
  if (!result.ok) return result;
  if (result.responseWindowOpened) {
    state.responseStack.push({ window: parentWindow, seatIndex, actionId: action.id, targetId, cardId, bidAmount });
    addLog(state, `席位 ${seatIndex + 1} 的响应又开启了第 ${(state.responseStack.length || 1) + 1} 层反应窗口。`, "response");
    return { ok: true, state, detail: `${result.detail}；进入嵌套反应。`, phaseResolved: false };
  }
  window.submissions[String(seatIndex)] = { seatIndex, actionId: action.id, targetId, cardId, status: "submitted" };
  const nextSeat = window.eligibleSeatIndexes.find((candidate) => !window.submissions[String(candidate)]);
  if (nextSeat !== undefined) {
    state.activeSeatIndex = nextSeat;
    addLog(state, `席位 ${seatIndex + 1} 已完成反应，等待席位 ${nextSeat + 1}。`, "response");
    return { ok: true, state, detail: result.detail || "已提交反应。", phaseResolved: false };
  }
  const detail = `${responseWindowSummary(window)}：${window.eligibleSeatIndexes.map((candidate) => `席位 ${candidate + 1}`).join("、")}`;
  return settleResponseWindowOrResumeParent(state, window, result.detail ? `${result.detail}；${detail}` : detail);
}

export function expireBoardGameResponseWindow(designValue, stateValue, nowValue = Date.now()) {
  const design = record(designValue);
  const engine = normalizeBoardGameEngine(design.engine);
  let state = clone(stateValue);
  normalizeBoardGameAdvancedState(state, state.seatCount);
  const window = state.pendingResponseWindow;
  if (!window) return { ok: false, code: "RESPONSE_WINDOW_NONE", message: "当前没有待处理的反应窗口。", state: stateValue };
  const now = Number(nowValue);
  if (!Number.isFinite(now) || now < Number(window.deadlineAt)) return { ok: false, code: "RESPONSE_WINDOW_NOT_EXPIRED", message: "反应窗口尚未超时。", state: stateValue };
  const defaultAction = window.defaultActionId && window.actionIds.includes(window.defaultActionId) ? actionFor(engine, window.defaultActionId) : null;
  const timedOutSeats = [];
  for (const seatIndex of window.eligibleSeatIndexes) {
    if (window.submissions?.[String(seatIndex)]) continue;
    let applied = false;
    if (defaultAction) {
      const result = applySingleAction(design, engine, state, { seatIndex, actionId: defaultAction.id, targetId: "", cardId: "", bidAmount: 0 }, { allowResponseWindow: false });
      applied = Boolean(result.ok);
    }
    window.submissions[String(seatIndex)] = { seatIndex, actionId: defaultAction?.id || "", targetId: "", cardId: "", status: "timeout", defaultApplied: applied };
    timedOutSeats.push(seatIndex);
  }
  const detail = `${responseWindowSummary(window, true)}：席位 ${timedOutSeats.map((index) => index + 1).join("、") || "无"}`;
  return settleResponseWindowOrResumeParent(state, window, detail, true);
}

function applySingleAction(design, engine, state, submission, options = {}) {
  const action = actionFor(engine, submission.actionId);
  const seatIndex = submission.seatIndex;
  const trackJump = actionTrackJump(engine, state, action, seatIndex);
  const beforeResource = action.resourceKey ? number(variableValue(design, state, seatIndex, action.resourceKey), 0) : 0;
  if (trackJump.cost > 0 && trackJump.resourceKey) {
    const beforeJump = number(variableValue(design, state, seatIndex, trackJump.resourceKey), 0);
    setVariableValue(design, state, seatIndex, trackJump.resourceKey, beforeJump - trackJump.cost);
  }
  if (action.cost > 0) setVariableValue(design, state, seatIndex, action.resourceKey, beforeResource - action.cost);
  const details = [];
  if (trackJump.cost > 0) details.push(`行动轨道跳跃支付 ${trackJump.cost} ${trackJump.resourceKey}`);
  if (action.kind === "move") {
    const unit = unitForSeat(state, seatIndex);
    if (unit) {
      const from = unit.nodeId;
      unit.nodeId = submission.targetId;
      state.lastMove = { unitId: unit.id, from, to: submission.targetId };
      details.push(`单位 ${from} → ${submission.targetId}`);
    }
  } else if (action.kind === "control") {
    state.owners[submission.targetId] = seatIndex;
    details.push(`控制 ${submission.targetId}`);
  } else if (action.kind === "place") {
    const unit = unitForSeat(state, seatIndex);
    if (unit) {
      unit.nodeId = submission.targetId;
      details.push(`工人放置于 ${submission.targetId}`);
    }
    const deckId = action.deckId || "";
    const deck = deckId ? state.decks?.[deckId] : null;
    if (Array.isArray(deck) && deck.length) {
      const claimedCard = deck.pop();
      if (!Array.isArray(state.claimedCards)) state.claimedCards = Array.from({ length: state.seatCount }, () => []);
      if (!Array.isArray(state.claimedCards[seatIndex])) state.claimedCards[seatIndex] = [];
      state.claimedCards[seatIndex].push(claimedCard);
      const cardEffects = applyCardEffects(design, state, seatIndex, claimedCard);
      details.push(`取得「${claimedCard.name}」${cardEffects.length ? `，卡面效果：${cardEffects.join("、")}` : ""}`);
    }
  } else if (action.kind === "claim_route") {
    const route = engine.map.edges.find((edge) => edge.id === submission.targetId);
    const routeCost = Math.max(1, number(route?.cost, 1));
    state.routeOwners[submission.targetId] = seatIndex;
    setVariableValue(design, state, seatIndex, action.resourceKey, number(variableValue(design, state, seatIndex, action.resourceKey), 0) - routeCost);
    const scoreVariable = (design.variables || []).find((variable) => variable.id === "score" && variable.scope === "player");
    if (scoreVariable) setVariableValue(design, state, seatIndex, "score", number(variableValue(design, state, seatIndex, "score"), 0) + routeCost);
    details.push(`占领路线 ${route?.label || submission.targetId}，支付 ${routeCost} ${action.resourceKey}，声望 +${routeCost}`);
  } else if (action.kind === "roll") {
    const count = integer(action.rollCount, 2, 1, 8);
    const sides = integer(action.rollSides, 6, 2, 20);
    const rolls = Array.from({ length: count }, () => Math.floor(nextRandom(state) * sides) + 1);
    const total = rolls.reduce((sum, value) => sum + value, 0);
    state.dice = rolls;
    state.riskProgress[seatIndex] = number(state.riskProgress[seatIndex]) + total;
    const bustThreshold = number(action.bustThreshold, 18);
    if (state.riskProgress[seatIndex] >= bustThreshold) {
      state.riskProgress[seatIndex] = 0;
      state.continueSeatIndex = null;
      details.push(`掷出 ${rolls.join("、")}，风险爆裂，本轮进度归零`);
    } else {
      state.continueSeatIndex = action.keepTurn ? seatIndex : null;
      details.push(`掷出 ${rolls.join("、")}，风险进度 ${state.riskProgress[seatIndex]}，可继续冒险`);
    }
    if (action.productionRules.length) {
      const production = applyBoardGameProduction(state, { rules: action.productionRules, rollTotal: total, rolls, activeSeatIndex: seatIndex, actionId: action.id, seed: state.randomState });
      for (const change of production) {
        const boundedBefore = change.before;
        setVariableValue(design, state, change.seatIndex, change.variableKey, change.after);
        const after = number(variableValue(design, state, change.seatIndex, change.variableKey), change.after);
        recordResponse(state, {
          sourceType: "action",
          sourceId: action.id,
          sourceLabel: action.label,
          seatIndex,
          targetScope: action.productionRules.find((rule) => rule.variableKey === change.variableKey)?.scope === "all_players" ? "all_players" : "self",
          targetSeatIndex: change.seatIndex,
          targetKey: change.variableKey,
          operation: "add",
          before: boundedBefore,
          after,
          visibility: "public",
          applied: true,
          detail: `${change.variableKey} +${change.amount}（骰点生产）`
        });
      }
      if (production.length) details.push(`按骰点 ${total} 生产 ${production.map((item) => `${item.variableKey}+${item.amount}`).join("、")}`);
    }
  } else if (action.kind === "stop") {
    const progress = number(state.riskProgress[seatIndex]);
    setVariableValue(design, state, seatIndex, "score", number(variableValue(design, state, seatIndex, "score"), 0) + progress);
    state.riskProgress[seatIndex] = 0;
    state.continueSeatIndex = null;
    details.push(`安全停手，结算风险 ${progress} 为声望`);
  } else if (action.kind === "gain") {
    const current = number(variableValue(design, state, seatIndex, action.resourceKey), 0);
    setVariableValue(design, state, seatIndex, action.resourceKey, current + action.amount);
    details.push(`${action.resourceKey} +${action.amount}`);
  } else if (action.kind === "pay") {
    const current = number(variableValue(design, state, seatIndex, action.resourceKey), 0);
    setVariableValue(design, state, seatIndex, action.resourceKey, current - Math.abs(action.amount || 1));
    details.push(`${action.resourceKey} -${Math.abs(action.amount || 1)}`);
  } else if (action.kind === "contribute") {
    const contribution = resolveBoardGameContribution(state, { seatIndex, resourceKey: action.resourceKey, amount: Math.max(1, action.amount || 1), poolKey: action.contributionPoolKey });
    if (!contribution.ok) return contribution;
    setVariableValue(design, state, seatIndex, action.resourceKey, number(state.playerValues[seatIndex]?.[action.resourceKey], 0));
    recordResponse(state, { sourceType: "action", sourceId: action.id, sourceLabel: action.label, seatIndex, targetScope: "public", targetKey: `pool.${contribution.poolKey}`, operation: "contribute", before: contribution.total - contribution.amount, after: contribution.total, visibility: "public", applied: true, detail: contribution.detail });
    details.push(contribution.detail);
  } else if (action.kind === "score") {
    state.scores[seatIndex] += action.amount;
    if (action.resourceKey) {
      const current = number(variableValue(design, state, seatIndex, action.resourceKey), 0);
      setVariableValue(design, state, seatIndex, action.resourceKey, current + action.amount);
    }
    details.push(`分数 ${action.amount >= 0 ? "+" : ""}${action.amount}`);
  } else if (action.kind === "bid") {
    details.push(`出价 ${integer(submission.bidAmount, 0, 0, 999999)}`);
  } else if (action.kind === "vote") {
    details.push(action.amount > 0 ? "投支持票" : "投反对票");
  } else if (action.kind === "draw") {
    const amount = Math.abs(action.amount || 1);
    const handVariable = (design.variables || []).find((variable) => variable.id === "hand" && variable.scope === "player");
    if (!handVariable) return { ok: false, code: "DRAW_HAND_MISSING", message: "抽牌行动没有绑定席位手牌数值。" };
    const deckId = deckIdForAction(state, action);
    const drawResult = drawBoardGameCards(state, { deckId, seatIndex, count: amount, reshuffleOnEmpty: action.reshuffleOnEmpty, deckScope: action.deckScope });
    if (!drawResult.ok) return { ok: false, code: drawResult.code, message: drawResult.detail };
    const drawnCards = drawResult.cards;
    const deck = number(variableValue(design, state, seatIndex, action.resourceKey), 0);
    setVariableValue(design, state, seatIndex, action.resourceKey, deck - amount);
    setVariableValue(design, state, seatIndex, "hand", number(variableValue(design, state, seatIndex, "hand"), 0) + amount);
    recordResponse(state, { sourceType: "action", sourceId: action.id, sourceLabel: action.label, seatIndex, targetScope: "self", targetSeatIndex: seatIndex, targetKey: "hand", operation: "draw", before: number(variableValue(design, state, seatIndex, "hand"), 0) - amount, after: number(variableValue(design, state, seatIndex, "hand"), 0), visibility: "private", applied: true, detail: drawResult.detail });
    details.push(`${drawResult.detail}${drawnCards[0]?.name ? `「${drawnCards[0].name}」` : ""}`);
  } else if (action.kind === "play") {
    const amount = Math.abs(action.amount || 1);
    if (!Array.isArray(state.hands)) state.hands = Array.from({ length: state.seatCount }, () => []);
    const hand = Array.isArray(state.hands[seatIndex]) ? state.hands[seatIndex] : [];
    const cardIndex = submission.cardId ? hand.findIndex((card) => card.id === submission.cardId) : 0;
    if (cardIndex < 0) return { ok: false, code: "CARD_NOT_IN_HAND", message: "指定卡牌不在当前席位手牌中。" };
    const playedCards = hand.splice(cardIndex, amount);
    setVariableValue(design, state, seatIndex, action.resourceKey, number(variableValue(design, state, seatIndex, action.resourceKey), 0) - amount);
    details.push(`打出 ${amount} 张牌${playedCards[0]?.name ? `「${playedCards[0].name}」` : ""}`);
    for (const card of playedCards) {
      const cardEffects = applyCardEffects(design, state, seatIndex, card, { visibility: "private" });
      if (cardEffects.length) details.push(`卡面效果：${cardEffects.join("、")}`);
    }
    const zoneResult = moveBoardGameCardsToZone(state, { deckId: deckIdForAction(state, action), seatIndex, cards: playedCards, destination: action.cardDestination, deckScope: action.deckScope });
    recordResponse(state, { sourceType: "action", sourceId: action.id, sourceLabel: action.label, seatIndex, targetScope: "self", targetSeatIndex: seatIndex, targetKey: `zone.${zoneResult.destination}`, operation: "move", before: 0, after: zoneResult.count, visibility: "private", applied: true, detail: `打出的牌进入${zoneResult.destination}区。` });
  } else if (["discard", "trash"].includes(action.kind)) {
    const hand = Array.isArray(state.hands?.[seatIndex]) ? state.hands[seatIndex] : [];
    const cardIndex = submission.cardId ? hand.findIndex((card) => card.id === submission.cardId) : 0;
    if (cardIndex < 0) return { ok: false, code: "CARD_NOT_IN_HAND", message: "指定卡牌不在当前席位手牌中。" };
    const [card] = hand.splice(cardIndex, 1);
    const zoneResult = moveBoardGameCardsToZone(state, { deckId: deckIdForAction(state, action), seatIndex, cards: [card], destination: action.kind === "trash" ? "removed" : "discard", deckScope: action.deckScope });
    if ((design.variables || []).some((variable) => variable.id === "hand" && variable.scope === "player")) setVariableValue(design, state, seatIndex, "hand", number(variableValue(design, state, seatIndex, "hand"), 0) - 1);
    recordResponse(state, { sourceType: "action", sourceId: action.id, sourceLabel: action.label, seatIndex, targetScope: "self", targetSeatIndex: seatIndex, targetKey: `zone.${zoneResult.destination}`, operation: "move", before: 1, after: 0, visibility: "private", applied: true, detail: `「${card?.name || card?.id || "卡牌"}」移入${zoneResult.destination}区。` });
    details.push(`处理卡牌「${card?.name || card?.id || "未命名"}」：${zoneResult.destination}`);
  } else if (action.kind === "place_tile") {
    const hand = Array.isArray(state.hands?.[seatIndex]) ? state.hands[seatIndex] : [];
    const cardIndex = submission.cardId ? hand.findIndex((card) => card.id === submission.cardId) : 0;
    if (cardIndex < 0) return { ok: false, code: "CARD_NOT_IN_HAND", message: "指定地块不在当前席位手牌中。" };
    const [tile] = hand.splice(cardIndex, 1);
    const edgeNeighbors = engine.map.edges.flatMap((edge) => {
      if (edge.from === submission.targetId) return [{ id: edge.to, side: edge.fromSide, oppositeSide: edge.toSide }];
      if (edge.bidirectional && edge.to === submission.targetId) return [{ id: edge.from, side: edge.toSide, oppositeSide: edge.fromSide }];
      return [];
    });
    const topology = engine.setup.tileTopology || {};
    const gridNeighbors = topology.gridAdjacency && engine.map.kind !== "area_graph"
      ? deriveBoardGameGridNeighbors(engine.map.nodes, state.tilePlacements, submission.targetId, engine.map.kind)
      : [];
    const neighbors = [...new Map([...edgeNeighbors, ...gridNeighbors].map((neighbor) => [neighbor.id, neighbor])).values()];
    const placement = placeBoardGameTile(state, {
      targetId: submission.targetId,
      tile,
      seatIndex,
      allowReplace: action.allowTileReplace,
      neighbors,
      requireAdjacent: action.tileRequireAdjacent || topology.requireAdjacent,
      matchEdges: action.tileMatchEdges || topology.matchEdges,
      rotation: action.tileRotation,
      gridKind: engine.map.kind
    });
    if (!placement.ok) return placement;
    if ((design.variables || []).some((variable) => variable.id === "hand" && variable.scope === "player")) setVariableValue(design, state, seatIndex, "hand", number(variableValue(design, state, seatIndex, "hand"), 0) - 1);
    recordResponse(state, { sourceType: "action", sourceId: action.id, sourceLabel: action.label, seatIndex, targetScope: "global", targetKey: `tile.${submission.targetId}`, operation: "place", before: placement.before, after: placement.after, visibility: "public", applied: true, detail: placement.detail });
    details.push(placement.detail);
  } else if (action.kind === "trade") {
    const toSeat = Number(submission.targetId);
    const beforeFrom = clone(state.playerValues[seatIndex] || {});
    const beforeTo = clone(state.playerValues[toSeat] || {});
    const trade = resolveBoardGameTrade(state, { fromSeat: seatIndex, toSeat, giveKey: action.tradeGiveKey, receiveKey: action.tradeReceiveKey, giveAmount: action.tradeGiveAmount, receiveAmount: action.tradeReceiveAmount });
    if (!trade.ok) return trade;
    for (const key of [action.tradeGiveKey, action.tradeReceiveKey]) {
      if ((design.variables || []).some((variable) => variable.id === key && variable.scope === "player")) {
        setVariableValue(design, state, seatIndex, key, number(state.playerValues[seatIndex]?.[key], 0));
        setVariableValue(design, state, toSeat, key, number(state.playerValues[toSeat]?.[key], 0));
      }
    }
    recordResponse(state, { sourceType: "action", sourceId: action.id, sourceLabel: action.label, seatIndex, targetScope: "target_player", targetSeatIndex: toSeat, targetKey: "trade", operation: "transfer", before: { from: beforeFrom, to: beforeTo }, after: { from: clone(state.playerValues[seatIndex]), to: clone(state.playerValues[toSeat]) }, visibility: "public", applied: true, detail: trade.detail });
    details.push(trade.detail);
  } else if (action.kind === "trade_offer") {
    const offer = createBoardGameTradeOffer(state, { fromSeat: seatIndex, toSeat: Number(submission.targetId), giveKey: action.tradeGiveKey, receiveKey: action.tradeReceiveKey, giveAmount: action.tradeGiveAmount, receiveAmount: action.tradeReceiveAmount, round: state.round });
    if (!offer.ok) return offer;
    recordResponse(state, { sourceType: "action", sourceId: action.id, sourceLabel: action.label, seatIndex, targetScope: "target_player", targetSeatIndex: offer.offer.toSeat, targetKey: "trade_offer", operation: "create", before: null, after: offer.offer, visibility: "public", applied: true, detail: offer.detail });
    details.push(`${offer.detail}（${offer.offer.id}）`);
  } else if (action.kind === "trade_confirm") {
    const confirmation = confirmBoardGameTradeOffer(state, { offerId: submission.targetId, seatIndex });
    if (!confirmation.ok) return confirmation;
    recordResponse(state, { sourceType: "action", sourceId: action.id, sourceLabel: action.label, seatIndex, targetScope: "public", targetKey: "trade", operation: "transfer", before: null, after: confirmation.trade, visibility: "public", applied: true, detail: confirmation.detail });
    details.push(confirmation.detail);
  } else if (action.kind === "trade_cancel") {
    const cancellation = cancelBoardGameTradeOffer(state, { offerId: submission.targetId, seatIndex });
    if (!cancellation.ok) return cancellation;
    recordResponse(state, { sourceType: "action", sourceId: action.id, sourceLabel: action.label, seatIndex, targetScope: "public", targetKey: "trade_offer", operation: "remove", before: cancellation.offer, after: null, visibility: "public", applied: true, detail: cancellation.detail });
    details.push(cancellation.detail);
  } else if (action.kind === "market_buy") {
    const beforeMarketResource = number(variableValue(design, state, seatIndex, action.resourceKey), 0);
    const purchase = resolveBoardGameMarketPurchase(state, { seatIndex, targetId: submission.targetId, resourceKey: action.resourceKey, destinationDeckId: action.deckId, deckScope: action.deckScope, priceDelta: action.marketPriceDelta, restock: action.marketRestock, destination: action.marketDestination, priceFloor: action.marketPriceFloor, priceCeiling: action.marketPriceCeiling, supplyDelta: action.marketSupplyDelta });
    if (!purchase.ok) return purchase;
    const card = purchase.card;
    setVariableValue(design, state, seatIndex, action.resourceKey, number(state.playerValues[seatIndex]?.[action.resourceKey], beforeMarketResource - purchase.price));
    const cardEffects = applyCardEffects(design, state, seatIndex, card, { visibility: "public" });
    details.push(`${purchase.detail}${cardEffects.length ? `；卡面效果：${cardEffects.join("、")}` : ""}`);
    recordResponse(state, { sourceType: "action", sourceId: action.id, sourceLabel: action.label, seatIndex, targetScope: "public", targetKey: `market.${card.id}`, operation: "buy", before: beforeMarketResource, after: number(variableValue(design, state, seatIndex, action.resourceKey), 0), visibility: "public", applied: true, detail: `${purchase.detail} 市场价差已记录。` });
  } else if (action.kind === "combat") {
    const defenderSeat = Number(submission.targetId);
    const combat = resolveBoardGameCombat(state, { attackerSeat: seatIndex, defenderSeat, attackKey: action.attackKey, defenseKey: action.defenseKey, damageKey: action.damageKey, scoreKey: action.combatScoreKey, attackBonus: action.attackBonus, defenseBonus: action.defenseBonus, damageCap: action.damageCap, shieldKey: action.shieldKey, retreatTargetId: action.retreatTargetId, controlTargetId: action.controlTargetId });
    if (!combat.ok) return combat;
    for (const key of [action.damageKey, action.combatScoreKey]) {
      if ((design.variables || []).some((variable) => variable.id === key && variable.scope === "player")) {
        setVariableValue(design, state, defenderSeat, action.damageKey, number(state.playerValues[defenderSeat]?.[action.damageKey], 0));
        setVariableValue(design, state, seatIndex, action.combatScoreKey, number(state.playerValues[seatIndex]?.[action.combatScoreKey], 0));
      }
    }
    recordResponse(state, { sourceType: "action", sourceId: action.id, sourceLabel: action.label, seatIndex, targetScope: "target_player", targetSeatIndex: defenderSeat, targetKey: action.damageKey, operation: "combat", before: combat.result.before.defenderDamage, after: combat.result.after.defenderDamage, visibility: "public", applied: true, detail: combat.detail });
    details.push(combat.detail);
  } else if (action.kind === "reveal") {
    const deckId = deckIdForAction(state, action);
    const actualDeck = action.deckScope === "personal" ? state.personalDecks?.[seatIndex]?.[deckId] : state.decks?.[deckId];
    const cards = [];
    for (let index = 0; index < action.revealCount; index += 1) {
      if (!Array.isArray(actualDeck) || !actualDeck.length) break;
      const cardIndex = action.cardId ? actualDeck.findIndex((item) => item.id === action.cardId) : actualDeck.length - 1;
      if (cardIndex < 0) break;
      const [card] = actualDeck.splice(cardIndex, 1);
      cards.push(card);
      if (action.revealVisibility === "public") state.revealed.unshift(card);
      else if (action.revealVisibility === "team") {
        const teamId = state.teamAssignments?.[seatIndex] || `team-${seatIndex + 1}`;
        if (!Array.isArray(state.teamRevealed[teamId])) state.teamRevealed[teamId] = [];
        state.teamRevealed[teamId].unshift(card);
      } else {
        if (!Array.isArray(state.privateRevealed[seatIndex])) state.privateRevealed[seatIndex] = [];
        state.privateRevealed[seatIndex].unshift(card);
      }
      recordResponse(state, {
        sourceType: "action", sourceId: action.id, sourceLabel: action.label, seatIndex,
        targetScope: action.revealVisibility === "team" ? "team" : action.revealVisibility === "private" ? "self" : "public",
        targetSeatIndex: seatIndex, targetKey: card.id, operation: "reveal", visibility: action.revealVisibility,
        applied: true, detail: `${action.revealVisibility === "public" ? "公开" : action.revealVisibility === "team" ? "团队公开" : "私密揭示"}「${card.name || card.id}」`
      });
      if (action.revealApplyEffects) applyCardEffects(design, state, seatIndex, card, { visibility: action.revealVisibility });
    }
    details.push(cards.length ? `${action.revealVisibility === "public" ? "公开" : action.revealVisibility === "team" ? "团队公开" : "私密揭示"}${cards.map((card) => `「${card.name || card.id}」`).join("、")}` : "没有可揭示对象");
  }
  if (action.cooldownRounds > 0) {
    if (!state.actionCooldowns[seatIndex]) state.actionCooldowns[seatIndex] = {};
    state.actionCooldowns[seatIndex][action.id] = action.cooldownRounds;
    const phaseActions = engine.setup.actionTrack.enabled && engine.setup.actionTrack.actionIds.length
      ? engine.setup.actionTrack.actionIds
      : (currentPhase(engine, state)?.actionIds || []);
    if (phaseActions.length) {
      const targetIndex = phaseActions.indexOf(action.id);
      state.actionTrack[seatIndex] = targetIndex >= 0 ? targetIndex : (number(state.actionTrack[seatIndex], 0) + action.rondelStep) % phaseActions.length;
    }
    details.push(`行动冷却 ${action.cooldownRounds} 回合`);
  }
  if (action.mechanismId || action.kind === "mechanism") {
    const mechanism = executeMechanism(design, state, seatIndex, action.mechanismId);
    if (!mechanism.ok) return mechanism;
    details.push(mechanism.detail);
  }
  const tableauTriggers = applyTableauTriggers(design, state, seatIndex, `action:${action.kind}`);
  if (tableauTriggers.length) details.push(`桌面触发：${tableauTriggers.join("；")}`);
  const queuedEffects = flushBoardGameEffectQueue(design, state, "after_action");
  if (queuedEffects.length) details.push(`延迟效果：${queuedEffects.map((change) => change.detail).join("；")}`);
  const detail = details.filter(Boolean).join("；") || "状态未发生数值变化";
  if (options.allowResponseWindow !== false && action.responseActionIds.length) {
    const responseWindow = openBoardGameResponseWindow(engine, state, action, submission);
    if (responseWindow) return { ok: true, detail: `${detail}；等待玩家响应（${responseWindow.timeoutSeconds} 秒）`, responseWindowOpened: true };
  }
  return { ok: true, detail };
}

function resolveBidSubmissions(design, engine, state, submissions, resolutionOrder) {
  const bids = submissions.filter((submission) => actionFor(engine, submission.actionId)?.kind === "bid");
  if (!bids.length) return { ok: true, detail: "本轮无人出价" };
  const orderIndex = new Map(resolutionOrder.map((seatIndex, index) => [seatIndex, index]));
  const targetIds = [...new Set(bids.map((submission) => submission.targetId).filter(Boolean))];
  if (targetIds.length > 1) return { ok: false, code: "BID_TARGET_CONFLICT", message: "同一并发竞价轮不能提交多个目标。" };
  const bidAction = actionFor(engine, bids[0].actionId);
  const bidMode = bidAction?.bidMode || "highest";
  const ordered = bids.slice().sort((left, right) => {
    const amountDelta = bidMode === "lowest"
      ? integer(left.bidAmount, 0, 0, 999999) - integer(right.bidAmount, 0, 0, 999999)
      : integer(right.bidAmount, 0, 0, 999999) - integer(left.bidAmount, 0, 0, 999999);
    return amountDelta || (bidAction?.bidTieMode === "first" ? 0 : orderIndex.get(left.seatIndex) - orderIndex.get(right.seatIndex));
  });
  const winner = ordered[0];
  const winningAction = actionFor(engine, winner.actionId);
  const secondBid = ordered[1] ? integer(ordered[1].bidAmount, 0, 0, 999999) : integer(winner.bidAmount, 0, 0, 999999);
  const winningBid = bidMode === "second_price"
    ? Math.min(999999, secondBid + number(winningAction?.bidSecondPriceOffset, 0))
    : integer(winner.bidAmount, 0, 0, 999999);
  const currency = winningAction?.resourceKey || "";
  if (currency) {
    const current = number(variableValue(design, state, winner.seatIndex, currency), 0);
    setVariableValue(design, state, winner.seatIndex, currency, current - winningBid);
  }
  const deckId = winningAction?.deckId || "";
  const deck = deckId ? state.decks?.[deckId] : null;
  const claimedCard = Array.isArray(deck) && deck.length ? deck.pop() : null;
  if (claimedCard) {
    if (!Array.isArray(state.claimedCards)) state.claimedCards = Array.from({ length: state.seatCount }, () => []);
    if (!Array.isArray(state.claimedCards[winner.seatIndex])) state.claimedCards[winner.seatIndex] = [];
    state.claimedCards[winner.seatIndex].push(claimedCard);
    const cardEffects = applyCardEffects(design, state, winner.seatIndex, claimedCard);
    claimedCard.effectDetails = cardEffects;
  }
  const mechanism = winningAction?.mechanismId ? executeMechanism(design, state, winner.seatIndex, winningAction.mechanismId) : { ok: true, detail: "" };
  if (!mechanism.ok) return mechanism;
  const queuedEffects = flushBoardGameEffectQueue(design, state, "after_action");
  if (!Array.isArray(state.auctionLog)) state.auctionLog = [];
  state.auctionLog.unshift({ mode: bidMode, targetId: targetIds[0] || winningAction?.bidTargetId || "", winnerSeatIndex: winner.seatIndex, submittedBids: ordered.map((submission) => ({ seatIndex: submission.seatIndex, amount: integer(submission.bidAmount, 0, 0, 999999) })), pricePaid: winningBid });
  state.auctionLog = state.auctionLog.slice(0, 100);
  const publicBids = ordered.map((submission) => `席位 ${submission.seatIndex + 1} ${integer(submission.bidAmount, 0, 0, 999999)}`).join("、");
  return {
    ok: true,
    detail: `公开出价：${publicBids}；席位 ${winner.seatIndex + 1} 以 ${winningBid} 赢得本轮遗物${claimedCard?.name ? `「${claimedCard.name}」` : ""}${claimedCard?.effectDetails?.length ? `，卡面效果：${claimedCard.effectDetails.join("、")}` : ""}${mechanism.detail ? `，${mechanism.detail}` : ""}${queuedEffects.length ? `，延迟效果：${queuedEffects.map((change) => change.detail).join("；")}` : ""}`
  };
}

function resolveVoteSubmissions(design, engine, state, submissions, phase) {
  const votes = submissions.filter((submission) => actionFor(engine, submission.actionId)?.kind === "vote");
  if (!votes.length) return { ok: true, detail: "本轮无人表决" };
  const yes = votes.filter((submission) => actionFor(engine, submission.actionId)?.amount > 0).length;
  const no = votes.length - yes;
  const passed = yes > no;
  const mechanismId = passed ? phase.votePassMechanismId : phase.voteFailMechanismId;
  // 表决结果属于公共结算：机制中的 player 数值默认作用于所有席位，不能误写到 0 号席位。
  const mechanism = mechanismId ? executeMechanism(design, state, 0, mechanismId, { defaultScope: "all_players" }) : { ok: true, detail: "" };
  if (!mechanism.ok) return mechanism;
  for (const submission of votes) {
    const matchesOutcome = (actionFor(engine, submission.actionId)?.amount > 0) === passed;
    if (!matchesOutcome) continue;
    for (const key of ["score", "influence"]) {
      const current = number(variableValue(design, state, submission.seatIndex, key), 0);
      if ((design.variables || []).some((variable) => variable.id === key && variable.scope === "player")) setVariableValue(design, state, submission.seatIndex, key, current + 1);
    }
  }
  const queuedEffects = flushBoardGameEffectQueue(design, state, "after_action");
  const result = passed ? "法案通过" : "法案否决";
  return { ok: true, detail: `公开表决：支持 ${yes}、反对 ${no}；${result}${mechanism.detail ? `，${mechanism.detail}` : ""}${queuedEffects.length ? `，延迟效果：${queuedEffects.map((change) => change.detail).join("；")}` : ""}` };
}

function resolveDraftSubmissions(design, engine, state, submissions) {
  const drafts = submissions.filter((submission) => actionFor(engine, submission.actionId)?.kind === "draft");
  if (!drafts.length) return { ok: true, detail: "本轮无人轮抽" };
  const draftAction = actionFor(engine, drafts[0].actionId);
  if (draftAction?.draftMode === "hand") {
    const nextHands = Array.from({ length: state.seatCount }, () => []);
    const details = [];
    for (const submission of drafts) {
      const hand = Array.isArray(state.hands?.[submission.seatIndex]) ? state.hands[submission.seatIndex] : [];
      const cardIndex = hand.findIndex((card) => card.id === submission.cardId);
      if (cardIndex < 0) return { ok: false, code: "CARD_NOT_IN_HAND", message: "轮抽结算时，所选卡牌已经不在该席位手中。" };
      const [card] = hand.splice(cardIndex, 1);
      state.claimedCards[submission.seatIndex].push(card);
      const effects = applyCardEffects(design, state, submission.seatIndex, card);
      details.push(`席位 ${submission.seatIndex + 1} 选择「${card.name}」${effects.length ? `（${effects.join("、")}）` : ""}`);
      const target = state.draftDirection === "left"
        ? (submission.seatIndex - 1 + state.seatCount) % state.seatCount
        : (submission.seatIndex + 1) % state.seatCount;
      nextHands[target] = hand;
    }
    state.hands = nextHands;
    flushBoardGameEffectQueue(design, state, "after_action");
    return { ok: true, detail: `手牌轮抽：${details.join("；")}；剩余手牌向${state.draftDirection === "left" ? "左" : "右"}传递` };
  }
  const selected = drafts.map((submission) => submission.cardId).filter(Boolean);
  if (new Set(selected).size !== selected.length) return { ok: false, code: "DRAFT_CONFLICT", message: "多名席位选择了同一张轮抽卡牌。" };
  const details = [];
  for (const submission of drafts) {
    const cardIndex = state.market.findIndex((card) => card.id === submission.cardId);
    if (cardIndex < 0) return { ok: false, code: "CARD_NOT_IN_MARKET", message: "轮抽结算时卡牌已被其他席位取走。" };
    const [card] = state.market.splice(cardIndex, 1);
    state.claimedCards[submission.seatIndex].push(card);
    const effects = applyCardEffects(design, state, submission.seatIndex, card);
    details.push(`席位 ${submission.seatIndex + 1} 取得「${card.name}」${effects.length ? `（${effects.join("、")}）` : ""}`);
  }
  const deckId = actionFor(engine, drafts[0].actionId)?.deckId || "";
  const deck = state.decks?.[deckId];
  while (Array.isArray(deck) && state.market.length < engine.setup.marketSize && deck.length) state.market.unshift(deck.pop());
  const queuedEffects = flushBoardGameEffectQueue(design, state, "after_action");
  return { ok: true, detail: `公开轮抽：${details.join("；")}${queuedEffects.length ? `；延迟效果：${queuedEffects.map((change) => change.detail).join("；")}` : ""}` };
}

export function executeBoardGameAction(designValue, stateValue, input = {}) {
  const design = record(designValue);
  const engine = normalizeBoardGameEngine(design.engine);
  const state = clone(stateValue);
  normalizeBoardGameAdvancedState(state, state.seatCount);
  state.teamAssignments = Array.from({ length: state.seatCount }, (_, index) => text(state.teamAssignments?.[index]) || `team-${index + 1}`);
  state.privateRevealed = Array.from({ length: state.seatCount }, (_, index) => Array.isArray(state.privateRevealed?.[index]) ? state.privateRevealed[index] : []);
  state.teamRevealed = state.teamRevealed && typeof state.teamRevealed === "object" ? state.teamRevealed : {};
  if (state.pendingResponseWindow) {
    const now = Number(input.serverNow ?? Date.now());
    if (Number.isFinite(now) && now >= Number(state.pendingResponseWindow.deadlineAt)) {
      return expireBoardGameResponseWindow(design, stateValue, now);
    }
    return applyPendingResponseAction(design, engine, state, input);
  }
  const seatIndex = integer(input.seatIndex ?? state.activeSeatIndex, 0, 0, Math.max(0, state.seatCount - 1));
  const action = actionFor(engine, input.actionId);
  if (!action) return { ok: false, code: "ACTION_MISSING", message: "行动不存在。", state: stateValue };
  const bidAmount = integer(input.bidAmount, 0, 0, 999999);
  const cardId = text(input.cardId, 160);
  const validation = validateAction(design, engine, state, action, text(input.targetId, 80), seatIndex, bidAmount, cardId);
  if (!validation.ok) return { ...validation, state: stateValue };
  const phase = currentPhase(engine, state);
  const submission = { seatIndex, actionId: action.id, targetId: text(input.targetId, 80), cardId, bidAmount };
  if (phase.mode === "sequential") {
    const result = applySingleAction(design, engine, state, submission);
    if (!result.ok) return { ...result, state: stateValue };
    state.resolved = !result.responseWindowOpened;
    addLog(state, `席位 ${seatIndex + 1} 执行「${action.label}」：${result.detail}。`, "resolution");
    return { ok: true, state, message: result.detail, phaseResolved: state.resolved };
  }
  state.submissions[String(seatIndex)] = submission;
  const remaining = Array.from({ length: state.seatCount }, (_, index) => index).filter((index) => !state.submissions[String(index)]);
  if (remaining.length) {
    state.activeSeatIndex = remaining[0];
    addLog(state, phase.mode === "reveal"
      ? `席位 ${seatIndex + 1} 已提交一个盖放选择，等待其余席位提交。`
      : `席位 ${seatIndex + 1} 已提交「${action.label}」，等待其余席位提交。`, "action");
    return { ok: true, state, message: "选择已提交，尚未结算。", phaseResolved: false };
  }
  const resolutions = [];
  const rotation = Math.max(0, (integer(state.round, 1, 1, 999) - 1) % Math.max(1, state.seatCount));
  const resolutionOrder = Array.from({ length: state.seatCount }, (_, index) => (rotation + index) % state.seatCount);
  const orderIndex = new Map(resolutionOrder.map((seatIndex, index) => [seatIndex, index]));
  const orderedSubmissions = Object.values(state.submissions).sort((left, right) => orderIndex.get(left.seatIndex) - orderIndex.get(right.seatIndex));
  const bidSubmissions = orderedSubmissions.filter((pending) => actionFor(engine, pending.actionId)?.kind === "bid");
  if (bidSubmissions.length) {
    const bidResult = resolveBidSubmissions(design, engine, state, bidSubmissions, resolutionOrder);
    if (!bidResult.ok) return { ...bidResult, state: stateValue };
    resolutions.push(bidResult.detail);
  }
  const voteSubmissions = orderedSubmissions.filter((pending) => actionFor(engine, pending.actionId)?.kind === "vote");
  if (voteSubmissions.length) {
    const voteResult = resolveVoteSubmissions(design, engine, state, voteSubmissions, phase);
    if (!voteResult.ok) return { ...voteResult, state: stateValue };
    resolutions.push(voteResult.detail);
  }
  const draftSubmissions = orderedSubmissions.filter((pending) => actionFor(engine, pending.actionId)?.kind === "draft");
  if (draftSubmissions.length) {
    const draftResult = resolveDraftSubmissions(design, engine, state, draftSubmissions);
    if (!draftResult.ok) return { ...draftResult, state: stateValue };
    resolutions.push(draftResult.detail);
  }
  for (const pending of orderedSubmissions.filter((item) => actionFor(engine, item.actionId)?.kind !== "bid")) {
    if (["vote", "draft"].includes(actionFor(engine, pending.actionId)?.kind)) continue;
    const result = applySingleAction(design, engine, state, pending);
    if (!result.ok) return { ...result, state: stateValue };
    resolutions.push(`席位 ${pending.seatIndex + 1}：${result.detail}`);
  }
  state.resolved = true;
  state.activeSeatIndex = 0;
  addLog(state, `${phase.mode === "reveal" ? "选择已统一公开" : "同时选择已统一结算"}：${resolutions.join("；")}。`, "resolution");
  return { ok: true, state, message: resolutions.join("；"), phaseResolved: true };
}

function defaultBoardGameSubmission(design, engine, state, seatIndex, excludedCardIds = new Set()) {
  const phase = currentPhase(engine, state);
  if (!phase) return null;
  for (const actionId of phase.actionIds) {
    const action = actionFor(engine, actionId);
    if (!action) continue;
    const targets = action.target === "none" ? [""] : legalBoardGameTargets(design, state, action.id, seatIndex);
    const cards = action.kind === "draft"
      ? (action.draftMode === "hand" ? (state.hands?.[seatIndex] || []) : (state.market || []))
      : action.kind === "play" ? (state.hands?.[seatIndex] || []) : [null];
    for (const targetId of targets) {
      for (const card of cards) {
        const cardId = card?.id || "";
        if (cardId && excludedCardIds.has(cardId)) continue;
        const validation = validateAction(design, engine, state, action, targetId, seatIndex, 0, cardId);
        if (validation.ok) return { seatIndex, actionId: action.id, targetId, cardId, bidAmount: 0 };
      }
    }
  }
  return null;
}

/**
 * Resolve a normal action phase after its server deadline. Missing seats take
 * the first legal deterministic action; public drafts prefer cards that have
 * not already been claimed in this submission window.
 */
export function expireBoardGamePhase(designValue, stateValue, nowValue = Date.now()) {
  const design = record(designValue);
  const engine = normalizeBoardGameEngine(design.engine);
  let state = clone(stateValue);
  normalizeBoardGameAdvancedState(state, state.seatCount);
  if (state.pendingResponseWindow) return expireBoardGameResponseWindow(design, state, nowValue);
  if (state.resolved || state.ended) return { ok: false, code: "PHASE_ALREADY_RESOLVED", message: "当前阶段已经结束。", state: stateValue };
  const phase = currentPhase(engine, state);
  if (!phase) return { ok: false, code: "PHASE_MISSING", message: "当前阶段不存在。", state: stateValue };
  const details = [];
  const maxSteps = Math.max(1, state.seatCount * 2 + 2);
  for (let step = 0; step < maxSteps && !state.resolved && !state.pendingResponseWindow; step += 1) {
    const seatIndex = integer(state.activeSeatIndex, 0, 0, Math.max(0, state.seatCount - 1));
    const excluded = new Set(Object.values(state.submissions || {}).map((submission) => submission?.cardId).filter(Boolean));
    const submission = defaultBoardGameSubmission(design, engine, state, seatIndex, excluded);
    if (!submission) return { ok: false, code: "PHASE_TIMEOUT_NO_DEFAULT", message: "超时后没有可执行的默认行动。", state: stateValue };
    const result = executeBoardGameAction(design, state, submission);
    if (!result.ok) return { ...result, state: stateValue };
    state = result.state;
    state.overdueSeats = [...new Set([...(state.overdueSeats || []), seatIndex])];
    details.push(`席位 ${seatIndex + 1} 自动执行「${actionFor(engine, submission.actionId)?.label || submission.actionId}」`);
  }
  if (!state.resolved && !state.pendingResponseWindow) {
    return { ok: false, code: "PHASE_TIMEOUT_STALLED", message: "超时默认行动未能完成阶段结算。", state: stateValue };
  }
  return {
    ok: true,
    state,
    detail: `${details.join("；")}${state.pendingResponseWindow ? "；进入响应窗口" : "；阶段已自动结算"}`,
    phaseResolved: Boolean(state.resolved),
    timedOut: true
  };
}

function compare(left, operator, right) {
  if (operator === "eq") return left === right;
  if (operator === "gt") return left > right;
  if (operator === "gte") return left >= right;
  if (operator === "lt") return left < right;
  if (operator === "lte") return left <= right;
  return false;
}

function checkEnded(design, engine, state) {
  const maxRoundReached = state.round > engine.maxRounds;
  const variableReached = (condition) => {
    const variable = (design.variables || []).find((item) => item.id === condition.variableKey);
    if (variable?.scope === "player") {
      return state.playerValues.some((values) => compare(number(values?.[condition.variableKey], 0), condition.operator, condition.value));
    }
    return compare(number(state.values[condition.variableKey], 0), condition.operator, condition.value);
  };
  const primaryReached = engine.endCondition.type === "rounds"
    ? maxRoundReached
    : variableReached(engine.endCondition);
  const alternateResults = engine.endConditions.map((condition) => ({ id: condition.id, passed: variableReached(condition) }));
  const alternateReached = alternateResults.some((item) => item.passed);
  const objectiveResults = [];
  for (let seatIndex = 0; seatIndex < state.seatCount; seatIndex += 1) {
    for (const objective of state.hiddenObjectives?.[seatIndex] || []) {
      const current = objective.scope === "global" ? number(state.values[objective.variableKey], 0) : number(state.playerValues[seatIndex]?.[objective.variableKey], 0);
      const passed = compare(current, objective.operator, objective.value);
      const previous = state.objectiveResults?.[seatIndex]?.find((item) => item.id === objective.id);
      if (passed && !objective.completed) {
        objective.completed = true;
        setVariableValue(design, state, seatIndex, "score", number(variableValue(design, state, seatIndex, "score"), 0) + objective.points);
      }
      if (previous) previous.completed = Boolean(objective.completed);
      objectiveResults.push({ seatIndex, id: objective.id, passed, points: objective.points });
    }
  }
  const majorityResults = evaluateBoardGameMajority(state, { rules: engine.setup.majorityRules });
  const tileComponentResults = evaluateBoardGameTileComponents(state, { edges: engine.map.edges, rules: engine.setup.tileTopology.scoringRules });
  state.tileComponentResults = tileComponentResults;
  const ended = Boolean(maxRoundReached || primaryReached || alternateReached);
  if (ended && !state.factionEndAwarded) {
    for (let seatIndex = 0; seatIndex < state.seatCount; seatIndex += 1) {
      const factionId = state.factionState?.[seatIndex]?.id;
      const rule = engine.setup.factionRules.find((candidate) => candidate.id === factionId);
      if (!rule?.endMechanismId) continue;
      const result = executeMechanism(design, state, seatIndex, rule.endMechanismId, { defaultScope: "self" });
      state.factionAudit.unshift({ seatIndex, factionId, hook: "end", mechanismId: rule.endMechanismId, ok: result.ok, detail: result.detail || result.message || "" });
    }
    state.factionEndAwarded = true;
  }
  if (ended && !state.majorityAwarded) {
    for (const result of majorityResults) {
      if (!result.points || !result.winners.length) continue;
      const points = result.tieMode === "split" ? result.points / result.winners.length : result.points;
      for (const seatIndex of result.winners) setVariableValue(design, state, seatIndex, "score", number(variableValue(design, state, seatIndex, "score"), 0) + points);
    }
    state.majorityAwarded = true;
  }
  if (ended && !state.topologyAwarded) {
    for (const component of tileComponentResults) {
      if (!component.points || !component.winners.length) continue;
      for (const seatIndex of component.winners) setVariableValue(design, state, seatIndex, "score", number(variableValue(design, state, seatIndex, "score"), 0) + component.points);
    }
    state.topologyAwarded = true;
  }
  const endgameMultipliers = [];
  if (ended && !state.endgameBonusesAwarded) {
    for (const rule of engine.setup.endgameMultipliers) {
      if (rule.scope === "global") {
        const globalValue = number(state.values[rule.variableKey], 0);
        if (!compare(globalValue, rule.operator, rule.value)) continue;
        for (let seatIndex = 0; seatIndex < state.seatCount; seatIndex += 1) {
          const before = number(variableValue(design, state, seatIndex, "score"), 0);
          const after = before * rule.multiplier + rule.points;
          setVariableValue(design, state, seatIndex, "score", after);
          endgameMultipliers.push({ id: rule.id, seatIndex, before, after, multiplier: rule.multiplier, points: rule.points, passed: true });
        }
      } else {
        for (let seatIndex = 0; seatIndex < state.seatCount; seatIndex += 1) {
          const current = number(variableValue(design, state, seatIndex, rule.variableKey), 0);
          const passed = compare(current, rule.operator, rule.value);
          if (!passed) {
            endgameMultipliers.push({ id: rule.id, seatIndex, passed: false, current });
            continue;
          }
          const before = number(variableValue(design, state, seatIndex, "score"), 0);
          const after = before * rule.multiplier + rule.points;
          setVariableValue(design, state, seatIndex, "score", after);
          endgameMultipliers.push({ id: rule.id, seatIndex, before, after, multiplier: rule.multiplier, points: rule.points, passed: true });
        }
      }
    }
    state.endgameBonusesAwarded = true;
  }
  const finalScores = Array.from({ length: state.seatCount }, (_, seatIndex) => ({
    seatIndex,
    score: number(variableValue(design, state, seatIndex, "score"), 0),
    objectivePoints: (objectiveResults.filter((item) => item.seatIndex === seatIndex && item.passed).reduce((sum, item) => sum + number(item.points, 0), 0)),
    majorityPoints: majorityResults.filter((item) => item.winners.includes(seatIndex)).reduce((sum, item) => sum + number(item.points, 0), 0)
  }));
  const ranking = finalScores.slice().sort((left, right) => right.score - left.score || right.objectivePoints - left.objectivePoints || right.majorityPoints - left.majorityPoints || left.seatIndex - right.seatIndex);
  const winnerScore = ranking[0]?.score;
  state.winnerSeatIndexes = ranking.filter((item) => item.score === winnerScore).map((item) => item.seatIndex);
  state.scores = finalScores.map((item) => item.score);
  appendBoardGameEndAudit(state, {
    round: state.round,
    primary: { type: engine.endCondition.type, passed: primaryReached },
    alternates: alternateResults,
    ended,
    objectives: objectiveResults,
    majority: majorityResults,
    tileComponents: tileComponentResults,
    factionAudit: state.factionAudit || [],
    multipliers: endgameMultipliers,
    finalScores,
    ranking,
    winnerSeatIndexes: state.winnerSeatIndexes,
    tieBreakOrder: engine.setup.tieBreakOrder,
    finalized: ended
  });
  return ended;
}

function applyRoundEffects(design, engine, state) {
  if (!engine.roundEffects.length) return [];
  const details = [];
  for (const effect of engine.roundEffects) {
    const changes = applyScopedEffect(design, state, 0, effect, {
      sourceType: "round",
      sourceId: effect.id,
      sourceLabel: "轮次结算",
      defaultScope: effect.scope || "all_players"
    });
    details.push(...changes.map((change) => change.detail));
  }
  return details;
}

function applyFactionRoundHooks(design, engine, state) {
  const details = [];
  for (let seatIndex = 0; seatIndex < state.seatCount; seatIndex += 1) {
    const factionId = state.factionState?.[seatIndex]?.id;
    const rule = engine.setup.factionRules.find((candidate) => candidate.id === factionId);
    if (!rule?.roundMechanismId) continue;
    const result = executeMechanism(design, state, seatIndex, rule.roundMechanismId, { defaultScope: "self" });
    state.factionAudit.unshift({ seatIndex, factionId, hook: "round_end", mechanismId: rule.roundMechanismId, ok: result.ok, detail: result.detail || result.message || "" });
    if (result.detail) details.push(`席位 ${seatIndex + 1} ${result.detail}`);
  }
  state.factionAudit = state.factionAudit.slice(0, 100);
  return details;
}

export function advanceBoardGameRuntime(designValue, stateValue) {
  const design = record(designValue);
  const engine = normalizeBoardGameEngine(design.engine);
  if (stateValue?.pendingResponseWindow) return { ok: false, code: "RESPONSE_WINDOW_PENDING", message: "反应窗口尚未完成，不能推进回合。", state: stateValue };
  if (!stateValue?.resolved || stateValue?.ended) return { ok: false, code: "PHASE_NOT_RESOLVED", message: "当前行动尚未结算。", state: stateValue };
  const state = clone(stateValue);
  const phase = currentPhase(engine, state);
  const keepCurrentSeat = phase?.mode === "sequential" && state.continueSeatIndex === state.activeSeatIndex;
  if (keepCurrentSeat) {
    state.continueSeatIndex = null;
  } else if (phase?.mode === "sequential" && state.activeSeatIndex < state.seatCount - 1) {
    state.activeSeatIndex += 1;
  } else {
    state.activeSeatIndex = 0;
    if (state.phaseIndex < engine.phases.length - 1) {
      state.phaseIndex += 1;
    } else {
      state.phaseIndex = 0;
      state.round += 1;
      const queuedRoundEffects = flushBoardGameEffectQueue(design, state, "round_end");
      if (queuedRoundEffects.length) addLog(state, `延迟效果结算：${queuedRoundEffects.map((change) => change.detail).join("；")}。`, "resolution");
      const roundDetails = applyRoundEffects(design, engine, state);
      if (roundDetails.length) addLog(state, `轮次结算：${roundDetails.join("；")}。`, "resolution");
      const roundTriggerDetails = Array.from({ length: state.seatCount }, (_, seatIndex) => applyTableauTriggers(design, state, seatIndex, "round_end")).flat();
      if (roundTriggerDetails.length) addLog(state, `桌面持续效果：${roundTriggerDetails.join("；")}。`, "resolution");
      const factionRoundDetails = applyFactionRoundHooks(design, engine, state);
      if (factionRoundDetails.length) addLog(state, `派系阶段钩子：${factionRoundDetails.join("；")}。`, "resolution");
      for (const seatCooldowns of state.actionCooldowns || []) {
        for (const actionId of Object.keys(seatCooldowns)) seatCooldowns[actionId] = Math.max(0, number(seatCooldowns[actionId]) - 1);
      }
      const maintenance = applyBoardGameMaintenance(state, { rules: engine.setup.maintenanceRules, round: state.round });
      if (maintenance.length) addLog(state, "维护结算：" + maintenance.map((item) => "席位 " + (item.seatIndex + 1) + " " + item.resourceKey + " 支付 " + item.paid + "/" + item.cost).join("；") + "。", "resolution");
      if (engine.setup.eraCleanup.everyRounds && state.round % engine.setup.eraCleanup.everyRounds === 0) {
        const moved = cleanupBoardGameEra(state, { ...engine.setup.eraCleanup, era: Math.floor(state.round / engine.setup.eraCleanup.everyRounds) });
        if (moved.length) addLog(state, "时代清理：移除 " + moved.length + " 个旧组件。", "resolution");
      }
    }
  }
  const draftAction = engine.actions.find((action) => action.kind === "draft" && action.draftMode === "hand");
  if (draftAction) {
    const endingAge = state.draftTurn >= engine.setup.draftTurnsPerAge;
    if (endingAge) {
      const discarded = state.hands.map((hand, seatIndex) => {
        const lastCard = Array.isArray(hand) ? hand[0] : null;
        state.hands[seatIndex] = [];
        if (lastCard) {
          const coinsVariable = (design.variables || []).find((variable) => variable.id === "coins" && variable.scope === "player");
          if (coinsVariable) setVariableValue(design, state, seatIndex, "coins", number(variableValue(design, state, seatIndex, "coins"), 0) + 3);
        }
        return lastCard?.name || "空手";
      });
      addLog(state, `第 ${state.draftAge} 时代结束：各席位处理最后一张手牌（${discarded.join("、")}），并获得保底金币。`, "resolution");
      state.draftAge += 1;
      state.draftTurn = 1;
      state.draftDirection = engine.setup.draftPassDirections[state.draftAge - 1] || "right";
      if (state.draftAge <= engine.setup.draftAgeCount) {
        dealDraftHands(state, draftAction.deckId, state.seatCount, engine.setup.handSize, state.draftAge);
        addLog(state, `进入第 ${state.draftAge} 时代，重新发放手牌，传递方向改为向${state.draftDirection === "left" ? "左" : "右"}。`, "system");
      }
    } else {
      state.draftTurn += 1;
    }
  }
  const phaseCard = revealPhaseDeck(engine, state, currentPhase(engine, state));
  if (phaseCard?.name) addLog(state, `公开当前牌面「${phaseCard.name}」。`, "event");
  state.submissions = {};
  state.resolved = false;
  state.lastMove = null;
  state.ended = checkEnded(design, engine, state);
  addLog(state, state.ended ? "已达到引擎声明的结束条件。" : `进入第 ${state.round} 轮「${currentPhase(engine, state)?.label || "阶段"}」，当前为席位 ${state.activeSeatIndex + 1}。`, "system");
  return { ok: true, state, ended: state.ended };
}

export function normalizeBoardGameRuntimeState(stateValue, designValue, seatCount = 0) {
  const signature = boardGameEngineSignature(designValue);
  if (!stateValue || stateValue.signature !== signature || stateValue.seatCount !== integer(seatCount || record(designValue).playerCount?.min, 2, 1, 99)) {
    return createBoardGameRuntimeState(designValue, seatCount);
  }
  const state = stateValue;
  const count = integer(seatCount || record(designValue).playerCount?.min, 2, 1, 99);
  state.claimedCards = Array.from({ length: count }, (_, index) => Array.isArray(state.claimedCards?.[index]) ? state.claimedCards[index] : []);
  state.hands = Array.from({ length: count }, (_, index) => Array.isArray(state.hands?.[index]) ? state.hands[index] : []);
  state.market = Array.isArray(state.market) ? state.market : [];
  state.routeOwners = record(state.routeOwners);
  state.riskProgress = Array.from({ length: count }, (_, index) => number(state.riskProgress?.[index], 0));
  state.dice = Array.isArray(state.dice) ? state.dice : [];
  state.teamAssignments = Array.from({ length: count }, (_, index) => text(state.teamAssignments?.[index]) || `team-${index + 1}`);
  state.privateRevealed = Array.from({ length: count }, (_, index) => Array.isArray(state.privateRevealed?.[index]) ? state.privateRevealed[index] : []);
  state.teamRevealed = state.teamRevealed && typeof state.teamRevealed === "object" ? state.teamRevealed : {};
  if (!Object.prototype.hasOwnProperty.call(state, "continueSeatIndex")) state.continueSeatIndex = null;
  state.responseSequence = integer(state.responseSequence, 0, 0, 1_000_000);
  state.responseEvents = Array.isArray(state.responseEvents) ? state.responseEvents.slice(0, 100) : [];
  state.effectQueue = Array.isArray(state.effectQueue) ? state.effectQueue.slice(0, 100) : [];
  state.pendingResponseWindow = state.pendingResponseWindow && typeof state.pendingResponseWindow === "object"
    ? state.pendingResponseWindow
    : null;
  normalizeBoardGameAdvancedState(state, count);
  return state;
}
