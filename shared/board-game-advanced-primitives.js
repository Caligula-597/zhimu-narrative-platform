// 桌游领域专用原语。它们只处理状态容器和确定性转移，费用、变量边界和响应事件由引擎负责。

import { gridDirections } from "./board-game-universal-kits.js";

const clone = (value) => structuredClone(value);
const integer = (value, fallback = 0, min = -1_000_000_000, max = 1_000_000_000) => {
  const parsed = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(parsed) ? Math.round(parsed) : fallback));
};
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const BOARD_GAME_CARD_DESTINATIONS = Object.freeze(["discard", "tableau", "removed"]);

export function createBoardGameAdvancedState(seatCount = 0) {
  const count = integer(seatCount, 0, 0, 99);
  return {
    discardPiles: {},
    personalDecks: Array.from({ length: count }, () => ({})),
    personalDiscardPiles: Array.from({ length: count }, () => ({})),
    tableaus: Array.from({ length: count }, () => []),
    removedCards: Array.from({ length: count }, () => []),
    tilePlacements: {},
    tileComponentResults: [],
    topologyAwarded: false,
    tradeOffers: [],
    actionCooldowns: Array.from({ length: count }, () => ({})),
    actionTrack: Array.from({ length: count }, () => 0),
    sharedPools: {},
    hiddenObjectives: Array.from({ length: count }, () => []),
    objectiveResults: Array.from({ length: count }, () => []),
    majorityResults: [],
    majorityAwarded: false,
    maintenanceLog: [],
    eraCleanupLog: [],
    marketPrices: {},
    auctionLog: [],
    tradeLog: [],
    combatLog: [],
    diceHistory: [],
    factionState: Array.from({ length: count }, () => ({ id: "", flags: {}, counters: {}, blockedActionIds: [] })),
    factionAudit: [],
    factionEndAwarded: false,
    endgameBonusesAwarded: false,
    triggerLog: [],
    responseStack: [],
    endAudit: []
  };
}

export function normalizeBoardGameAdvancedState(state, seatCount = 0) {
  const count = integer(seatCount, 0, 0, 99);
  const defaults = createBoardGameAdvancedState(count);
  if (!state || typeof state !== "object") return defaults;
  state.discardPiles = state.discardPiles && typeof state.discardPiles === "object" ? state.discardPiles : {};
  state.personalDecks = Array.from({ length: count }, (_, index) => state.personalDecks?.[index] && typeof state.personalDecks[index] === "object" ? state.personalDecks[index] : {});
  state.personalDiscardPiles = Array.from({ length: count }, (_, index) => state.personalDiscardPiles?.[index] && typeof state.personalDiscardPiles[index] === "object" ? state.personalDiscardPiles[index] : {});
  state.tableaus = Array.from({ length: count }, (_, index) => Array.isArray(state.tableaus?.[index]) ? state.tableaus[index] : []);
  state.removedCards = Array.from({ length: count }, (_, index) => Array.isArray(state.removedCards?.[index]) ? state.removedCards[index] : []);
  state.tilePlacements = state.tilePlacements && typeof state.tilePlacements === "object" ? state.tilePlacements : {};
  state.tileComponentResults = Array.isArray(state.tileComponentResults) ? state.tileComponentResults.slice(0, 100) : [];
  state.topologyAwarded = Boolean(state.topologyAwarded);
  state.tradeOffers = Array.isArray(state.tradeOffers) ? state.tradeOffers.slice(0, 100) : [];
  state.actionCooldowns = Array.from({ length: count }, (_, index) => state.actionCooldowns?.[index] && typeof state.actionCooldowns[index] === "object" ? { ...state.actionCooldowns[index] } : {});
  state.actionTrack = Array.from({ length: count }, (_, index) => integer(state.actionTrack?.[index], 0, 0, 999));
  state.sharedPools = state.sharedPools && typeof state.sharedPools === "object" ? { ...state.sharedPools } : {};
  state.hiddenObjectives = Array.from({ length: count }, (_, index) => Array.isArray(state.hiddenObjectives?.[index]) ? state.hiddenObjectives[index].map(clone) : []);
  state.objectiveResults = Array.from({ length: count }, (_, index) => Array.isArray(state.objectiveResults?.[index]) ? state.objectiveResults[index].map(clone) : []);
  state.majorityResults = Array.isArray(state.majorityResults) ? state.majorityResults.slice(0, 100) : [];
  state.majorityAwarded = Boolean(state.majorityAwarded);
  state.maintenanceLog = Array.isArray(state.maintenanceLog) ? state.maintenanceLog.slice(0, 100) : [];
  state.eraCleanupLog = Array.isArray(state.eraCleanupLog) ? state.eraCleanupLog.slice(0, 100) : [];
  state.marketPrices = state.marketPrices && typeof state.marketPrices === "object" ? state.marketPrices : {};
  state.auctionLog = Array.isArray(state.auctionLog) ? state.auctionLog.slice(0, 100) : [];
  state.tradeLog = Array.isArray(state.tradeLog) ? state.tradeLog.slice(0, 100) : [];
  state.combatLog = Array.isArray(state.combatLog) ? state.combatLog.slice(0, 100) : [];
  state.diceHistory = Array.isArray(state.diceHistory) ? state.diceHistory.slice(0, 100) : [];
  state.factionState = Array.from({ length: count }, (_, index) => state.factionState?.[index] && typeof state.factionState[index] === "object"
    ? { id: String(state.factionState[index].id || ""), flags: { ...(state.factionState[index].flags || {}) }, counters: { ...(state.factionState[index].counters || {}) }, blockedActionIds: Array.isArray(state.factionState[index].blockedActionIds) ? [...state.factionState[index].blockedActionIds] : [] }
    : clone(defaults.factionState[index]));
  state.factionAudit = Array.isArray(state.factionAudit) ? state.factionAudit.slice(0, 100) : [];
  state.factionEndAwarded = Boolean(state.factionEndAwarded);
  state.endgameBonusesAwarded = Boolean(state.endgameBonusesAwarded);
  state.triggerLog = Array.isArray(state.triggerLog) ? state.triggerLog.slice(0, 200) : [];
  state.responseStack = Array.isArray(state.responseStack) ? state.responseStack.slice(0, 3) : [];
  state.endAudit = Array.isArray(state.endAudit) ? state.endAudit.slice(0, 100) : [];
  return state;
}

function ensureDiscardPile(state, deckId) {
  if (!Array.isArray(state.discardPiles[deckId])) state.discardPiles[deckId] = [];
  return state.discardPiles[deckId];
}

function ensurePersonalDiscardPile(state, seatIndex, deckId) {
  if (!state.personalDiscardPiles[seatIndex]) state.personalDiscardPiles[seatIndex] = {};
  if (!Array.isArray(state.personalDiscardPiles[seatIndex][deckId])) state.personalDiscardPiles[seatIndex][deckId] = [];
  return state.personalDiscardPiles[seatIndex][deckId];
}

function deckAndDiscard(state, { deckId, seatIndex, deckScope = "shared" } = {}) {
  if (deckScope === "personal") {
    if (!state.personalDecks[seatIndex]) state.personalDecks[seatIndex] = {};
    if (!Array.isArray(state.personalDecks[seatIndex][deckId])) state.personalDecks[seatIndex][deckId] = [];
    return { deck: state.personalDecks[seatIndex][deckId], discard: ensurePersonalDiscardPile(state, seatIndex, deckId) };
  }
  if (!Array.isArray(state.decks?.[deckId])) return { deck: null, discard: ensureDiscardPile(state, deckId) };
  return { deck: state.decks[deckId], discard: ensureDiscardPile(state, deckId) };
}

export function drawBoardGameCards(state, { deckId, seatIndex, count = 1, reshuffleOnEmpty = true, deckScope = "shared" } = {}) {
  const amount = integer(count, 1, 1, 100);
  const { deck, discard } = deckAndDiscard(state, { deckId, seatIndex, deckScope });
  if (!deck) return { ok: false, code: "DECK_MISSING", cards: [], detail: "目标牌库不存在。" };
  const drawn = [];
  while (drawn.length < amount) {
    if (!deck.length && reshuffleOnEmpty && discard.length) {
      deck.push(...discard.splice(0).reverse());
    }
    if (!deck.length) break;
    drawn.push(deck.pop());
  }
  if (!Array.isArray(state.hands[seatIndex])) state.hands[seatIndex] = [];
  state.hands[seatIndex].push(...drawn);
  return {
    ok: drawn.length === amount,
    code: drawn.length === amount ? "DRAW_OK" : "DECK_EMPTY",
    cards: drawn,
    detail: drawn.length === amount ? `抽取 ${drawn.length} 张牌。` : `牌库与弃牌堆合计只剩 ${drawn.length} 张牌。`
  };
}

export function moveBoardGameCardsToZone(state, { deckId = "", seatIndex, cards = [], destination = "discard", deckScope = "shared" } = {}) {
  const target = BOARD_GAME_CARD_DESTINATIONS.includes(destination) ? destination : "discard";
  const list = cards.filter(Boolean).map(clone);
  if (target === "discard") {
    if (deckScope === "personal") ensurePersonalDiscardPile(state, seatIndex, deckId).push(...list);
    else ensureDiscardPile(state, deckId).push(...list);
  }
  if (target === "tableau") state.tableaus[seatIndex].push(...list);
  if (target === "removed") state.removedCards[seatIndex].push(...list);
  return { destination: target, count: list.length, cards: list };
}

function rotateEdges(edges, rotation = 0, gridKind = "square") {
  const source = edges && typeof edges === "object" ? edges : {};
  const order = gridDirections(gridKind).map((direction) => direction.side);
  const steps = ((integer(rotation, 0, 0, order.length - 1) % order.length) + order.length) % order.length;
  return Object.fromEntries(order.map((side, index) => [side, source[order[(index - steps + order.length) % order.length]] ?? null]));
}

export function placeBoardGameTile(state, { targetId, tile, seatIndex, allowReplace = false, neighbors = [], requireAdjacent = false, matchEdges = false, rotation = 0, gridKind = "square" } = {}) {
  if (!targetId || !tile) return { ok: false, code: "TILE_TARGET_MISSING", detail: "地块缺少位置或牌面。" };
  if (state.tilePlacements[targetId] && !allowReplace) return { ok: false, code: "TILE_OCCUPIED", detail: "目标位置已经有地块。" };
  const adjacent = neighbors.filter((neighbor) => neighbor && state.tilePlacements[neighbor.id]);
  if (requireAdjacent && Object.keys(state.tilePlacements).length && !adjacent.length) return { ok: false, code: "TILE_NOT_ADJACENT", detail: "这块地块必须与已有地块相邻。" };
  const rotatedEdges = rotateEdges(tile.edges, rotation, gridKind);
  if (matchEdges && adjacent.length) {
    const mismatches = adjacent.filter((neighbor) => {
      const placed = state.tilePlacements[neighbor.id];
      if (!neighbor.side || !neighbor.oppositeSide) return false;
      const ownEdge = rotatedEdges[neighbor.side];
      const otherEdges = rotateEdges(placed.edges, placed.rotation || 0, gridKind);
      const otherEdge = otherEdges[neighbor.oppositeSide];
      return ownEdge !== null && otherEdge !== null && ownEdge !== undefined && otherEdge !== undefined && ownEdge !== otherEdge;
    });
    if (mismatches.length) return { ok: false, code: "TILE_EDGE_MISMATCH", detail: "地块边缘与相邻地块不匹配。" };
  }
  const before = state.tilePlacements[targetId] ? clone(state.tilePlacements[targetId]) : null;
  state.tilePlacements[targetId] = { ...clone(tile), edges: rotatedEdges, rotation: integer(rotation, 0, 0, gridKind === "hex" ? 5 : 3), placedBy: seatIndex, placementId: `${targetId}:${tile.id || "tile"}` };
  return { ok: true, before, after: clone(state.tilePlacements[targetId]), detail: `地块已放置于 ${targetId}。` };
}

export function evaluateBoardGameTileComponents(state, { edges = [], rules = [] } = {}) {
  const placements = state.tilePlacements && typeof state.tilePlacements === "object" ? state.tilePlacements : {};
  const placedIds = Object.keys(placements);
  const adjacency = new Map(placedIds.map((id) => [id, []]));
  for (const edge of Array.isArray(edges) ? edges : []) {
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) continue;
    adjacency.get(edge.from).push(edge.to);
    if (edge.bidirectional !== false) adjacency.get(edge.to).push(edge.from);
  }
  const visited = new Set();
  const components = [];
  for (const start of placedIds) {
    if (visited.has(start)) continue;
    const queue = [start];
    const nodeIds = [];
    visited.add(start);
    while (queue.length) {
      const current = queue.shift();
      nodeIds.push(current);
      for (const next of adjacency.get(current) || []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    const placementsInComponent = nodeIds.map((id) => placements[id]);
    const tags = new Set(placementsInComponent.flatMap((tile) => Array.isArray(tile?.tags) ? tile.tags : []));
    const counts = {};
    placementsInComponent.forEach((tile) => {
      if (Number.isInteger(tile?.placedBy)) counts[tile.placedBy] = (counts[tile.placedBy] || 0) + 1;
    });
    const maxCount = Math.max(0, ...Object.values(counts));
    const winners = Object.entries(counts).filter(([, count]) => count === maxCount && maxCount > 0).map(([seatIndex]) => Number(seatIndex));
    const matchedRules = (Array.isArray(rules) ? rules : []).filter((rule) => (
      nodeIds.length >= Number(rule.minSize || 1) && (!rule.tag || tags.has(rule.tag))
    ));
    components.push({
      id: `tile-component-${components.length + 1}`,
      nodeIds,
      size: nodeIds.length,
      tags: [...tags],
      counts,
      winners,
      points: matchedRules.reduce((sum, rule) => sum + number(rule.points, 0), 0),
      ruleIds: matchedRules.map((rule) => rule.id)
    });
  }
  return components;
}

export function resolveBoardGameMarketPurchase(state, { seatIndex, targetId, resourceKey, destinationDeckId = "", deckScope = "shared", priceDelta = 0, restock = true, destination = "tableau", priceFloor = 0, priceCeiling = 999999, supplyDelta = 0 } = {}) {
  const marketIndex = Array.isArray(state.market) ? state.market.findIndex((card) => card.id === targetId) : -1;
  if (marketIndex < 0) return { ok: false, code: "CARD_NOT_IN_MARKET", detail: "目标卡牌不在公共市场。" };
  const card = state.market[marketIndex];
  const marketKey = String(card.marketKey || card.tags?.[0] || card.id);
  const dynamicDelta = number(state.marketPrices[marketKey], 0);
  const price = Math.max(0, number(card.price ?? card.cost, 0) + dynamicDelta);
  const resources = state.playerValues[seatIndex] || {};
  if (number(resources[resourceKey]) < price) return { ok: false, code: "RESOURCE_NOT_ENOUGH", detail: "资源不足，不能购买市场卡牌。" };
  state.playerValues[seatIndex] = { ...resources, [resourceKey]: number(resources[resourceKey]) - price };
  state.market.splice(marketIndex, 1);
  if (!Array.isArray(state.claimedCards[seatIndex])) state.claimedCards[seatIndex] = [];
  state.claimedCards[seatIndex].push(clone(card));
  if (destination === "tableau") state.tableaus[seatIndex].push(clone(card));
  if (destination === "discard") {
    const destinationId = destinationDeckId || card.deckId || "market";
    if (deckScope === "personal") ensurePersonalDiscardPile(state, seatIndex, destinationId).push(clone(card));
    else ensureDiscardPile(state, destinationId).push(clone(card));
  }
  state.marketPrices[marketKey] = Math.max(number(priceFloor, 0), Math.min(number(priceCeiling, 999999), dynamicDelta + number(priceDelta, 1) - number(supplyDelta, 0)));
  if (restock && card.deckId && Array.isArray(state.decks?.[card.deckId]) && state.decks[card.deckId].length) state.market.unshift(state.decks[card.deckId].pop());
  return { ok: true, card: clone(card), price, marketKey, detail: `购买市场卡「${card.name || card.id}」，支付 ${price}。` };
}

export function resolveBoardGameTrade(state, { fromSeat, toSeat, giveKey, receiveKey, giveAmount = 1, receiveAmount = 1 } = {}) {
  const give = integer(giveAmount, 1, 1, 999999);
  const receive = integer(receiveAmount, 1, 1, 999999);
  const from = state.playerValues[fromSeat] || {};
  const to = state.playerValues[toSeat] || {};
  if (!giveKey || !receiveKey || from[giveKey] < give || to[receiveKey] < receive) return { ok: false, code: "TRADE_RESOURCE_NOT_ENOUGH", detail: "交易双方资源不足，交易未发生。" };
  const nextFrom = { ...from, [giveKey]: number(from[giveKey]) - give, [receiveKey]: number(from[receiveKey]) + receive };
  const nextTo = { ...to, [receiveKey]: number(to[receiveKey]) - receive, [giveKey]: number(to[giveKey]) + give };
  state.playerValues[fromSeat] = nextFrom;
  state.playerValues[toSeat] = nextTo;
  const trade = { fromSeat, toSeat, giveKey, giveAmount: give, receiveKey, receiveAmount: receive };
  state.tradeLog.unshift(trade);
  state.tradeLog = state.tradeLog.slice(0, 100);
  return { ok: true, trade, detail: `席位 ${fromSeat + 1} 与席位 ${toSeat + 1} 完成交易。` };
}

export function createBoardGameTradeOffer(state, { fromSeat, toSeat, giveKey, receiveKey, giveAmount = 1, receiveAmount = 1, round = 0 } = {}) {
  const give = integer(giveAmount, 1, 1, 999999);
  const receive = integer(receiveAmount, 1, 1, 999999);
  const from = state.playerValues[fromSeat] || {};
  if (!giveKey || !receiveKey || from[giveKey] < give) return { ok: false, code: "TRADE_RESOURCE_NOT_ENOUGH", detail: "发起交易时资源不足。" };
  const offer = { id: `trade-${round}-${fromSeat}-${state.tradeOffers.length + 1}`, fromSeat, toSeat, giveKey, receiveKey, giveAmount: give, receiveAmount: receive, status: "pending", confirmedBy: [fromSeat] };
  state.tradeOffers.unshift(offer);
  state.tradeOffers = state.tradeOffers.slice(0, 100);
  return { ok: true, offer: clone(offer), detail: `席位 ${fromSeat + 1} 发起了一笔等待确认的交易。` };
}

export function confirmBoardGameTradeOffer(state, { offerId, seatIndex } = {}) {
  const index = state.tradeOffers.findIndex((offer) => offer.id === offerId && offer.status === "pending");
  if (index < 0) return { ok: false, code: "TRADE_OFFER_MISSING", detail: "交易报价不存在或已经结束。" };
  const offer = state.tradeOffers[index];
  if (offer.toSeat !== seatIndex) return { ok: false, code: "TRADE_CONFIRM_FORBIDDEN", detail: "只有交易接收方可以确认这笔报价。" };
  const trade = resolveBoardGameTrade(state, offer);
  if (!trade.ok) return trade;
  state.tradeOffers.splice(index, 1);
  return { ok: true, trade: trade.trade, detail: `交易报价已确认，席位 ${offer.fromSeat + 1} 与席位 ${offer.toSeat + 1} 完成原子转移。` };
}

export function cancelBoardGameTradeOffer(state, { offerId, seatIndex } = {}) {
  const index = state.tradeOffers.findIndex((offer) => offer.id === offerId && offer.status === "pending");
  if (index < 0) return { ok: false, code: "TRADE_OFFER_MISSING", detail: "交易报价不存在或已经结束。" };
  const offer = state.tradeOffers[index];
  if (![offer.fromSeat, offer.toSeat].includes(seatIndex)) return { ok: false, code: "TRADE_CANCEL_FORBIDDEN", detail: "只有交易双方可以撤回报价。" };
  state.tradeOffers.splice(index, 1);
  return { ok: true, offer: clone(offer), detail: "交易报价已撤回，未发生资源转移。" };
}

export function resolveBoardGameCombat(state, { attackerSeat, defenderSeat, attackKey, defenseKey, damageKey = "damage", scoreKey = "score", minimumDamage = 1, attackBonus = 0, defenseBonus = 0, damageCap = 999999, shieldKey = "", retreatTargetId = "", controlTargetId = "" } = {}) {
  const attacker = state.playerValues[attackerSeat] || {};
  const defender = state.playerValues[defenderSeat] || {};
  const attack = number(attacker[attackKey]) + number(attackBonus);
  const defense = number(defender[defenseKey]) + number(defenseBonus);
  const rawDamage = Math.max(0, attack - defense, integer(minimumDamage, 1, 0, 999999) * (attack > defense ? 1 : 0));
  const shield = shieldKey ? number(defender[shieldKey]) : 0;
  const absorbed = Math.min(shield, rawDamage);
  const damage = Math.min(number(damageCap, 999999), Math.max(0, rawDamage - absorbed));
  const before = { attack, defense, defenderDamage: number(defender[damageKey]), defenderShield: shield, attackerScore: number(attacker[scoreKey]) };
  const defenderAfter = { ...defender, [damageKey]: Math.max(0, before.defenderDamage + damage) };
  if (shieldKey) defenderAfter[shieldKey] = Math.max(0, shield - absorbed);
  state.playerValues[defenderSeat] = defenderAfter;
  state.playerValues[attackerSeat] = { ...attacker, [scoreKey]: before.attackerScore + (damage > 0 ? 1 : 0) };
  const retreat = damage > 0 && retreatTargetId ? { seatIndex: defenderSeat, targetId: retreatTargetId } : null;
  if (retreat && Array.isArray(state.units)) state.units.filter((unit) => unit.seatIndex === defenderSeat).forEach((unit) => { unit.nodeId = retreat.targetId; });
  if (controlTargetId && damage > 0) {
    if (!state.owners || typeof state.owners !== "object") state.owners = {};
    state.owners[controlTargetId] = attackerSeat;
  }
  const result = { attackerSeat, defenderSeat, attack, defense, rawDamage, absorbed, damage, retreat, controlTargetId, before, after: { defenderDamage: state.playerValues[defenderSeat][damageKey], defenderShield: shieldKey ? state.playerValues[defenderSeat][shieldKey] : undefined, attackerScore: state.playerValues[attackerSeat][scoreKey] } };
  state.combatLog.unshift(result);
  state.combatLog = state.combatLog.slice(0, 100);
  return { ok: true, result, detail: `战斗结算：攻击 ${attack}，防御 ${defense}，造成 ${damage} 点损失。` };
}

export function applyBoardGameProduction(state, { rules = [], rollTotal = 0, rolls = [], activeSeatIndex = 0, actionId = "", seed = "" } = {}) {
  const applied = [];
  for (const rule of Array.isArray(rules) ? rules : []) {
    const min = number(rule.min, 0);
    const max = number(rule.max, Number.POSITIVE_INFINITY);
    if (rollTotal < min || rollTotal > max) continue;
    const target = rule.scope === "all_players" ? Array.from({ length: state.seatCount }, (_, index) => index) : [activeSeatIndex];
    for (const seatIndex of target) {
      if (!state.playerValues[seatIndex]) state.playerValues[seatIndex] = {};
      const before = number(state.playerValues[seatIndex][rule.variableKey]);
      const after = before + number(rule.amount, 1);
      state.playerValues[seatIndex][rule.variableKey] = after;
      applied.push({ seatIndex, variableKey: rule.variableKey, before, after, amount: number(rule.amount, 1) });
    }
  }
  state.diceHistory.unshift({ total: rollTotal, rolls: Array.isArray(rolls) ? [...rolls] : [], activeSeatIndex, actionId, seed, production: clone(applied) });
  state.diceHistory = state.diceHistory.slice(0, 100);
  return applied;
}

export function appendBoardGameEndAudit(state, entry) {
  if (!Array.isArray(state.endAudit)) state.endAudit = [];
  state.endAudit.unshift({ ...clone(entry), id: `end-audit-${Date.now().toString(36)}-${state.endAudit.length + 1}` });
  state.endAudit = state.endAudit.slice(0, 100);
}

export function resolveBoardGameContribution(state, { seatIndex, resourceKey, amount = 1, poolKey = "crisis" } = {}) {
  const value = integer(amount, 1, 1, 999999);
  const player = state.playerValues[seatIndex] || {};
  if (!resourceKey || number(player[resourceKey]) < value) return { ok: false, code: "CONTRIBUTION_RESOURCE_NOT_ENOUGH", detail: "公共危机投入所需资源不足。" };
  state.playerValues[seatIndex] = { ...player, [resourceKey]: number(player[resourceKey]) - value };
  state.sharedPools[poolKey] = number(state.sharedPools[poolKey]) + value;
  return { ok: true, poolKey, resourceKey, amount: value, total: state.sharedPools[poolKey], detail: `投入 ${value} ${resourceKey} 到公共池「${poolKey}」。` };
}

export function applyBoardGameMaintenance(state, { rules = [], round = 0 } = {}) {
  const changes = [];
  for (const rule of Array.isArray(rules) ? rules : []) {
    const seats = rule.scope === "self" ? [Number(rule.seatIndex || 0)] : Array.from({ length: state.seatCount }, (_, index) => index);
    for (const seatIndex of seats) {
      const player = state.playerValues[seatIndex] || {};
      const before = number(player[rule.resourceKey]);
      const cost = Math.max(0, number(rule.cost, 0));
      const paid = Math.min(before, cost);
      const after = before - paid;
      state.playerValues[seatIndex] = { ...player, [rule.resourceKey]: after };
      const shortfall = cost - paid;
      if (shortfall && rule.penaltyKey) state.playerValues[seatIndex][rule.penaltyKey] = number(state.playerValues[seatIndex][rule.penaltyKey]) + shortfall * number(rule.penaltyAmount, 1);
      changes.push({ seatIndex, resourceKey: rule.resourceKey, before, after, cost, paid, shortfall, round });
    }
  }
  state.maintenanceLog.unshift(...changes);
  state.maintenanceLog = state.maintenanceLog.slice(0, 100);
  return changes;
}

export function cleanupBoardGameEra(state, { deckIds = [], discardMarket = false, era = 0 } = {}) {
  const moved = [];
  const zones = new Set(Array.isArray(arguments[1]?.zones) && arguments[1].zones.length ? arguments[1].zones : ["decks", "market"]);
  const migrateToAge = arguments[1]?.migrateToAge == null ? null : integer(arguments[1].migrateToAge, 0, 0, 99);
  const migrationDeckId = String(arguments[1]?.migrationDeckId || "");
  const retire = (cards, deckId, destination) => {
    const retained = [];
    for (const card of Array.isArray(cards) ? cards : []) {
      if (number(card.age, 0) && number(card.age, 0) < era) {
        if (migrateToAge != null) {
          const migrated = { ...clone(card), age: migrateToAge };
          if (migrationDeckId && state.decks?.[migrationDeckId]) state.decks[migrationDeckId].push(migrated);
          else retained.push(migrated);
          moved.push({ deckId, cardId: card.id, from: destination, action: "migrate", toAge: migrateToAge, migrationDeckId });
        } else {
          ensureDiscardPile(state, deckId || "era").push(card);
          moved.push({ deckId: deckId || "era", cardId: card.id, from: destination, action: "retire" });
        }
      } else retained.push(card);
    }
    return retained;
  };
  if (zones.has("decks")) {
    for (const deckId of Array.isArray(deckIds) ? deckIds : []) {
      const deck = state.decks?.[deckId];
      if (Array.isArray(deck)) state.decks[deckId] = retire(deck, deckId, "decks");
    }
  }
  if ((discardMarket || zones.has("market")) && Array.isArray(state.market) && state.market.length) {
    const cards = state.market.splice(0);
    const retained = retire(cards, cards[0]?.deckId || "market", "market");
    if (retained.length) state.market.push(...retained);
  }
  if (zones.has("hands")) state.hands = state.hands.map((cards, seatIndex) => retire(cards, `hand-${seatIndex}`, "hands"));
  if (zones.has("claimedCards")) state.claimedCards = state.claimedCards.map((cards, seatIndex) => retire(cards, `claimed-${seatIndex}`, "claimedCards"));
  if (zones.has("tableaus")) state.tableaus = state.tableaus.map((cards, seatIndex) => retire(cards, `tableau-${seatIndex}`, "tableaus"));
  if (zones.has("personalDecks")) state.personalDecks = state.personalDecks.map((decks, seatIndex) => Object.fromEntries(Object.entries(decks || {}).map(([deckId, cards]) => [deckId, retire(cards, `personal-${seatIndex}-${deckId}`, "personalDecks")] )));
  if (zones.has("personalDiscardPiles")) state.personalDiscardPiles = state.personalDiscardPiles.map((decks, seatIndex) => Object.fromEntries(Object.entries(decks || {}).map(([deckId, cards]) => [deckId, retire(cards, `personal-discard-${seatIndex}-${deckId}`, "personalDiscardPiles")] )));
  state.eraCleanupLog.unshift({ era, zones: [...zones], moved: clone(moved) });
  state.eraCleanupLog = state.eraCleanupLog.slice(0, 100);
  return moved;
}

export function evaluateBoardGameMajority(state, { rules = [] } = {}) {
  const results = [];
  for (const rule of Array.isArray(rules) ? rules : []) {
    const nodeIds = new Set(Array.isArray(rule.nodeIds) ? rule.nodeIds : []);
    const counts = Array.from({ length: state.seatCount }, () => 0);
    for (const unit of state.units || []) if (nodeIds.has(unit.nodeId) && Number.isInteger(unit.seatIndex)) counts[unit.seatIndex] += number(rule.unitValue, 1);
    const highest = Math.max(0, ...counts);
    const winners = counts.map((value, seatIndex) => value === highest && highest > 0 ? seatIndex : null).filter((seatIndex) => seatIndex !== null);
    results.push({ id: String(rule.id || rule.regionId || `majority-${results.length + 1}`), counts, winners, points: number(rule.points, 0), tieMode: rule.tieMode || "all" });
  }
  state.majorityResults = results;
  return results;
}
