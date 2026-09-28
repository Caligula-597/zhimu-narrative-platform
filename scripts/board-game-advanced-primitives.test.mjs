import assert from "node:assert/strict";
import test from "node:test";
import { advanceBoardGameRuntime, compileBoardGameEngine, executeBoardGameAction, createBoardGameRuntimeState } from "../shared/board-game-engine.js";
import { evaluateBoardGameTileComponents } from "../shared/board-game-advanced-primitives.js";
import { normalizeBoardGameDesign } from "../shared/board-game-design.js";
import { projectBoardGamePublicState, projectBoardGameViewerState } from "../shared/board-game-online-runtime.js";

function advancedDesign() {
  return normalizeBoardGameDesign({
    title: "高级原语测试",
    playerCount: { min: 2, max: 2 },
    variables: [
      { id: "hand", scope: "player", initialValue: 1, min: 0, max: 20 },
      { id: "coins", scope: "player", initialValue: 5, min: 0, max: 20 },
      { id: "wood", scope: "player", initialValue: 3, min: 0, max: 20 },
      { id: "grain", scope: "player", initialValue: 1, min: 0, max: 20 },
      { id: "attack", scope: "player", initialValue: 4, min: 0, max: 20 },
      { id: "defense", scope: "player", initialValue: 1, min: 0, max: 20 },
      { id: "damage", scope: "player", initialValue: 0, min: 0, max: 20 },
      { id: "score", scope: "player", initialValue: 0, min: 0, max: 20 }
    ],
    components: [{ id: "deck", type: "deck", name: "测试牌库", entries: [
      { id: "card-a", name: "牌 A", quantity: 2, effects: [] },
      { id: "tile-a", name: "地块 A", quantity: 1, effects: [] }
    ] }],
    engine: {
      maxRounds: 2,
      map: { kind: "area_graph", nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [] },
      phases: [{ id: "p", label: "高级原语", mode: "sequential", actionIds: ["draw", "discard", "tile", "trade", "market", "combat", "roll"] }],
      actions: [
        { id: "draw", label: "抽牌", kind: "draw", phaseId: "p", target: "none", deckId: "deck", resourceKey: "coins", amount: 1 },
        { id: "discard", label: "弃牌", kind: "discard", phaseId: "p", target: "none", deckId: "deck" },
        { id: "tile", label: "放地块", kind: "place_tile", phaseId: "p", target: "empty_tile", deckId: "deck" },
        { id: "trade", label: "交易", kind: "trade", phaseId: "p", target: "opponent_seat", tradeGiveKey: "wood", tradeReceiveKey: "grain", tradeGiveAmount: 1, tradeReceiveAmount: 1 },
        { id: "market", label: "买市场卡", kind: "market_buy", phaseId: "p", target: "market_card", resourceKey: "coins" },
        { id: "combat", label: "战斗", kind: "combat", phaseId: "p", target: "opponent_seat", attackKey: "attack", defenseKey: "defense", damageKey: "damage", combatScoreKey: "score" },
        { id: "roll", label: "骰点生产", kind: "roll", phaseId: "p", target: "none", rollCount: 1, rollSides: 2, productionRules: [{ min: 1, max: 20, variableKey: "grain", amount: 2 }] }
      ],
      setup: { unitsPerSeat: 0, startingNodeIds: [], seed: "advanced-primitives", factionRules: [{ id: "faction-a", startingSeat: 0, flags: { public: true }, counters: { momentum: 1 } }] },
      endCondition: { type: "rounds", value: 2 },
      information: "private"
    }
  });
}

function fresh() {
  const design = advancedDesign();
  const state = createBoardGameRuntimeState(design, 2);
  state.decks.deck = [
    { id: "draw-1", name: "抽牌 1", effects: [] },
    { id: "draw-2", name: "抽牌 2", effects: [] }
  ];
  state.hands[0] = [{ id: "tile-1", name: "地块 1" }];
  state.hands[1] = [{ id: "hand-1", name: "手牌 1" }];
  state.market = [{ id: "market-1", name: "市场卡", cost: 2, deckId: "deck", effects: [] }];
  state.playerValues[0] = { hand: 1, coins: 5, wood: 3, grain: 1, attack: 4, defense: 1, damage: 0, score: 0 };
  state.playerValues[1] = { hand: 1, coins: 5, wood: 1, grain: 3, attack: 2, defense: 1, damage: 0, score: 0 };
  return { design, state };
}

function act(design, state, actionId, input = {}) {
  state.resolved = false;
  state.ended = false;
  return executeBoardGameAction(design, state, { actionId, seatIndex: 0, ...input });
}

test("advanced primitives complete card zones, tile placement, trade, market, combat and dice production", () => {
  const { design, state } = fresh();
  let result = act(design, state, "tile", { targetId: "a", cardId: "tile-1" });
  assert.equal(result.ok, true);
  assert.equal(result.state.tilePlacements.a.placedBy, 0);
  result = act(design, result.state, "draw");
  assert.equal(result.ok, true);
  assert.equal(result.state.hands[0].length, 1);
  result = act(design, result.state, "discard", { cardId: "draw-2" });
  assert.equal(result.ok, true);
  assert.equal(result.state.discardPiles.deck.length, 1);
  result = act(design, result.state, "trade", { targetId: "1" });
  assert.equal(result.ok, true);
  assert.equal(result.state.playerValues[0].wood, 2);
  assert.equal(result.state.playerValues[0].grain, 2);
  result = act(design, result.state, "market", { targetId: "market-1" });
  assert.equal(result.ok, true);
  assert.equal(result.state.market.length, 1);
  assert.equal(result.state.marketPrices['market-1'], 1);
  assert.equal(result.state.marketPrices["market-1"], 1);
  result = act(design, result.state, "combat", { targetId: "1" });
  assert.equal(result.ok, true);
  assert.equal(result.state.playerValues[1].damage, 3);
  result = act(design, result.state, "roll");
  assert.equal(result.ok, true);
  assert.ok(result.state.diceHistory.length >= 1);
  assert.ok(result.state.responseEvents.some((event) => event.operation === "combat"));
  assert.ok(result.state.responseEvents.some((event) => event.operation === "transfer"));
  result.state.resolved = true;
  const advanced = advanceBoardGameRuntime(design, result.state);
  assert.equal(advanced.ok, true);
  assert.ok(advanced.state.endAudit.length >= 1);
  assert.equal(advanced.state.factionState[0].id, "faction-a");
});

test("personal deck cycles are isolated per seat, reshuffle their own discard and stay private online", () => {
  const design = advancedDesign();
  design.engine.phases[0].actionIds = ["draw-personal", "discard-personal"];
  design.engine.actions = [
    { id: "draw-personal", label: "个人抽牌", kind: "draw", phaseId: "p", target: "none", deckId: "deck", deckScope: "personal", resourceKey: "coins", amount: 1 },
    { id: "discard-personal", label: "个人弃牌", kind: "discard", phaseId: "p", target: "none", deckId: "deck", deckScope: "personal" }
  ];
  design.engine.setup.personalDecks = [{ deckId: "deck", entryIds: ["card-a"], initialHandSize: 1, cardLimit: 2 }];
  const state = createBoardGameRuntimeState(design, 2);
  assert.equal(state.personalDecks[0].deck.length, 1);
  assert.equal(state.personalDecks[1].deck.length, 1);
  assert.notEqual(state.personalDecks[0].deck[0].id, state.personalDecks[1].deck[0].id);
  assert.equal(state.hands[0].length, 1);
  const drawn = act(design, state, "draw-personal");
  assert.equal(drawn.ok, true);
  assert.equal(drawn.state.hands[0].length, 2);
  const discarded = act(design, drawn.state, "discard-personal", { cardId: drawn.state.hands[0][0].id });
  assert.equal(discarded.ok, true);
  assert.equal(discarded.state.personalDiscardPiles[0].deck.length, 1);
  assert.equal(discarded.state.discardPiles.deck?.length || 0, 0);
  const recycled = act(design, discarded.state, "draw-personal");
  assert.equal(recycled.ok, true);
  assert.equal(recycled.state.personalDiscardPiles[0].deck.length, 0);
  assert.equal(recycled.state.hands[0].length, 2);
  const publicState = projectBoardGamePublicState(recycled.state);
  assert.equal(publicState.personalDecks[0].deck.count, 0);
  assert.equal(publicState.personalDecks[0].deck.id, undefined);
  const viewerState = projectBoardGameViewerState(recycled.state, 0);
  assert.equal(Array.isArray(viewerState.viewer.personalDecks.deck), true);
});

test("advanced action references are compiler-checked", () => {
  const design = advancedDesign();
  design.engine.actions.find((action) => action.id === "trade").tradeGiveKey = "missing";
  const report = compileBoardGameEngine(design, 2);
  assert.ok(report.issues.some((issue) => issue.code === "ENGINE_TRADE_VARIABLE_MISSING"));
  const state = createBoardGameRuntimeState(design, 2);
  assert.ok(Array.isArray(state.tableaus));
});

test("advanced private faction state and card zones respect online projections", () => {
  const { state } = fresh();
  state.factionState[0] = { id: "faction-a", flags: { secret: true }, counters: { hidden: 2 } };
  state.factionState[1] = { id: "faction-b", flags: { secret: false }, counters: { hidden: 5 } };
  state.tableaus[0] = [{ id: "public-a" }];
  state.tableaus[1] = [{ id: "private-b" }];
  const publicState = projectBoardGamePublicState(state);
  const viewer = projectBoardGameViewerState(state, 0);
  assert.deepEqual(publicState.factionState, [{ id: "faction-a" }, { id: "faction-b" }]);
  assert.equal(viewer.viewer.faction.counters.hidden, 2);
  assert.equal(viewer.viewer.tableau[0].id, "public-a");
  assert.equal(viewer.viewer.hand.length, 1);
});

test("topology placement, confirmed trade windows, market bounds and combat modifiers resolve atomically", () => {
  const { design, state } = fresh();
  const tileAction = design.engine.actions.find((action) => action.id === "tile");
  tileAction.tileRequireAdjacent = true;
  tileAction.tileMatchEdges = true;
  design.engine.map.edges.push({ id: "a-b", from: "a", to: "b", bidirectional: true, fromSide: "east", toSide: "west" });
  state.tilePlacements.a = { id: "base", edges: { east: "road" }, rotation: 0, placedBy: 1 };
  state.hands[0] = [{ id: "tile-2", name: "相邻地块", edges: { west: "road" } }];
  state.playerValues[0].hand = 1;
  let result = executeBoardGameAction(design, state, { actionId: "tile", seatIndex: 0, targetId: "b", cardId: "tile-2" });
  assert.equal(result.ok, true);
  assert.equal(result.state.tilePlacements.b.edges.west, "road");

  const phase = design.engine.phases[0];
  phase.actionIds.push("offer", "confirm", "cancel");
  design.engine.actions.push(
    { id: "offer", label: "发起交易", kind: "trade_offer", phaseId: phase.id, target: "opponent_seat", tradeGiveKey: "wood", tradeReceiveKey: "grain", tradeGiveAmount: 1, tradeReceiveAmount: 1 },
    { id: "confirm", label: "确认交易", kind: "trade_confirm", phaseId: phase.id, target: "trade_offer" },
    { id: "cancel", label: "撤回交易", kind: "trade_cancel", phaseId: phase.id, target: "trade_offer" }
  );
  result.state.activeSeatIndex = 0;
  result.state.resolved = false;
  result = executeBoardGameAction(design, result.state, { actionId: "offer", seatIndex: 0, targetId: "1" });
  assert.equal(result.ok, true);
  assert.equal(result.state.tradeOffers.length, 1);
  const offerId = result.state.tradeOffers[0].id;
  result.state.activeSeatIndex = 1;
  result.state.resolved = false;
  result = executeBoardGameAction(design, result.state, { actionId: "confirm", seatIndex: 1, targetId: offerId });
  assert.equal(result.ok, true);
  assert.equal(result.state.tradeOffers.length, 0);
  assert.equal(result.state.tradeLog.length, 1);

  const marketAction = design.engine.actions.find((action) => action.id === "market");
  marketAction.marketPriceFloor = 0;
  marketAction.marketPriceCeiling = 1;
  marketAction.marketSupplyDelta = 5;
  result.state.activeSeatIndex = 0;
  result.state.resolved = false;
  result = executeBoardGameAction(design, result.state, { actionId: "market", seatIndex: 0, targetId: "market-1" });
  assert.equal(result.ok, true);
  assert.equal(result.state.marketPrices["market-1"], 0);

  const combatAction = design.engine.actions.find((action) => action.id === "combat");
  combatAction.shieldKey = "shield";
  combatAction.attackBonus = 1;
  combatAction.damageCap = 2;
  combatAction.retreatTargetId = "a";
  combatAction.controlTargetId = "b";
  result.state.playerValues[1].shield = 1;
  result.state.activeSeatIndex = 0;
  result.state.resolved = false;
  result = executeBoardGameAction(design, result.state, { actionId: "combat", seatIndex: 0, targetId: "1" });
  assert.equal(result.ok, true);
  assert.equal(result.state.playerValues[1].shield, 0);
  assert.equal(result.state.playerValues[1].damage, 2);
  assert.equal(result.state.owners.b, 0);
});

test("commercial pacing protocols apply cooldown, cooperation, maintenance, hidden objectives, majority and era cleanup", () => {
  let { design, state } = fresh();
  const phase = design.engine.phases[0];
  phase.actionIds.push("contribute", "cooldown");
  design.engine.actions.push(
    { id: "contribute", label: "投入危机池", kind: "contribute", phaseId: phase.id, target: "none", resourceKey: "wood", amount: 1, contributionPoolKey: "crisis" },
    { id: "cooldown", label: "循环行动", kind: "gain", phaseId: phase.id, target: "none", resourceKey: "wood", amount: 1, cooldownRounds: 2, rondelStep: 2 }
  );
  design.engine.setup.maintenanceRules = [{ resourceKey: "wood", cost: 2, penaltyKey: "score", penaltyAmount: 1 }];
  design.engine.setup.eraCleanup = { everyRounds: 1, deckIds: ["deck"], discardMarket: true };
  design.engine.setup.majorityRules = [{ id: "ab-majority", nodeIds: ["a", "b"], points: 3, tieMode: "all" }];
  design.engine.setup.hiddenObjectives = [{ id: "rich", label: "保有大量木材", variableKey: "wood", operator: "gte", value: 99, points: 5 }];
  state = createBoardGameRuntimeState(design, 2);
  state.units = [{ id: "u0", seatIndex: 0, nodeId: "a" }, { id: "u1", seatIndex: 0, nodeId: "b" }, { id: "u2", seatIndex: 1, nodeId: "a" }];
  state.decks.deck = [{ id: "old-card", age: 1, deckId: "deck" }];
  state.market = [{ id: "old-market", age: 1, deckId: "deck" }];
  state.resolved = false;
  let result = executeBoardGameAction(design, state, { actionId: "contribute", seatIndex: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.state.sharedPools.crisis, 1);
  result.state.resolved = false;
  result = executeBoardGameAction(design, result.state, { actionId: "cooldown", seatIndex: 0 });
  assert.equal(result.ok, true);
  result.state.resolved = false;
  const blocked = executeBoardGameAction(design, result.state, { actionId: "cooldown", seatIndex: 0 });
  assert.equal(blocked.code, "ACTION_COOLDOWN");
  result.state.resolved = true;
  result.state.activeSeatIndex = 1;
  const advanced = advanceBoardGameRuntime(design, result.state);
  assert.equal(advanced.ok, true);
  assert.equal(advanced.state.maintenanceLog.length, 2);
  assert.equal(advanced.state.eraCleanupLog.length, 1);
  assert.equal(advanced.state.market.length, 0);
  assert.equal(advanced.state.majorityResults[0].winners[0], 0);
  assert.equal(advanced.state.hiddenObjectives[0][0].completed, false);
  assert.equal(advanced.state.actionCooldowns[0].cooldown, 1);
});

test("tableau triggers and continuous effects resolve through the shared response chain", () => {
  const { design, state } = fresh();
  const normalizedCardDesign = normalizeBoardGameDesign({ components: [{ id: "trigger-deck", type: "deck", entries: [{ id: "trigger-card", name: "触发牌", triggers: [{ event: "round_end", effects: [{ targetKey: "score", operation: "add", value: "1" }] }], continuousEffects: [{ targetKey: "grain", operation: "add", value: "1" }] }] }] });
  assert.equal(normalizedCardDesign.components[0].entries[0].triggers.length, 1);
  assert.equal(normalizedCardDesign.components[0].entries[0].continuousEffects.length, 1);
  state.tableaus[0] = [{
    id: "engine-card",
    name: "轮转引擎",
    triggers: [{ id: "on-roll", event: "action:roll", effects: [{ id: "roll-score", targetKey: "score", operation: "add", value: "2" }] }],
    continuousEffects: [{ id: "round-grain", targetKey: "grain", operation: "add", value: "1" }]
  }];
  let result = act(design, state, "roll");
  assert.equal(result.ok, true);
  assert.equal(result.state.playerValues[0].score, 2);
  assert.equal(result.state.triggerLog[0].sourceType, "tableau_trigger");
  result.state.resolved = true;
  result.state.activeSeatIndex = 1;
  result = advanceBoardGameRuntime(design, result.state);
  assert.equal(result.ok, true);
  assert.equal(result.state.playerValues[0].grain, 4);
  assert.ok(result.state.triggerLog.some((item) => item.sourceType === "tableau_continuous" && item.event === "round_end"));
});

test("connected tile components award configured tag points to the component majority", () => {
  const { design, state } = fresh();
  design.engine.map.edges.push({ id: "a-b", from: "a", to: "b", bidirectional: true });
  design.engine.setup.tileTopology.scoringRules = [{ id: "forest-chain", tag: "forest", minSize: 2, points: 4 }];
  state.tilePlacements = {
    a: { id: "forest-a", tags: ["forest"], placedBy: 0 },
    b: { id: "forest-b", tags: ["forest"], placedBy: 0 },
    isolated: { id: "stone", tags: ["stone"], placedBy: 1 }
  };
  const components = evaluateBoardGameTileComponents(state, { edges: design.engine.map.edges, rules: design.engine.setup.tileTopology.scoringRules });
  assert.equal(components[0].size, 2);
  assert.deepEqual(components[0].winners, [0]);
  assert.equal(components[0].points, 4);
  state.resolved = true;
  state.activeSeatIndex = 1;
  state.round = 2;
  const result = advanceBoardGameRuntime(design, state);
  assert.equal(result.ok, true);
  assert.equal(result.state.playerValues[0].score, 4);
  assert.equal(result.state.tileComponentResults[0].ruleIds[0], "forest-chain");
});

test("faction round and end hooks execute once and are auditable", () => {
  const { design, state } = fresh();
  design.mechanisms.push({
    id: "faction-pulse",
    name: "派系脉冲",
    conditions: [],
    effects: [{ id: "faction-score", targetKey: "score", operation: "add", value: "1" }]
  });
  design.engine.setup.factionRules[0].roundMechanismId = "faction-pulse";
  design.engine.setup.factionRules[0].endMechanismId = "faction-pulse";
  let result = { ok: true, state };
  result.state.resolved = true;
  result.state.activeSeatIndex = 1;
  result = advanceBoardGameRuntime(design, result.state);
  assert.equal(result.state.playerValues[0].score, 1);
  result.state.resolved = true;
  result.state.activeSeatIndex = 1;
  result = advanceBoardGameRuntime(design, result.state);
  assert.equal(result.state.ended, true);
  assert.equal(result.state.playerValues[0].score, 3);
  assert.equal(result.state.factionAudit.filter((item) => item.seatIndex === 0).length, 3);
  assert.ok(result.state.factionAudit.some((item) => item.seatIndex === 0 && item.hook === "end"));
  assert.ok(result.state.endAudit[0].factionAudit.some((item) => item.hook === "end"));
});

test("universal grid kit derives hex adjacency and supports six-sided edge matching", () => {
  const { design, state } = fresh();
  design.engine.map.kind = "hex";
  design.engine.map.nodes[0].gridX = 0;
  design.engine.map.nodes[0].gridY = 0;
  design.engine.map.nodes[1].gridX = 1;
  design.engine.map.nodes[1].gridY = 0;
  design.engine.map.edges = [];
  design.engine.setup.tileTopology = { requireAdjacent: true, matchEdges: true, gridAdjacency: true };
  state.tilePlacements.a = { id: "hex-a", edges: { east: "road" }, rotation: 0, placedBy: 1 };
  state.hands[0] = [{ id: "hex-b", name: "六角地块", edges: { west: "road" } }];
  const result = executeBoardGameAction(design, state, { actionId: "tile", seatIndex: 0, targetId: "b", cardId: "hex-b" });
  assert.equal(result.ok, true);
  assert.equal(result.state.tilePlacements.b.edges.west, "road");
  assert.equal(result.state.tilePlacements.b.rotation, 0);
});

test("universal sealed auction kit supports second-price concurrent settlement", () => {
  const { design, state } = fresh();
  design.engine.phases[0].mode = "simultaneous";
  design.engine.phases[0].actionIds = ["sealed-bid"];
  design.engine.actions.push({ id: "sealed-bid", label: "密封竞价", kind: "bid", phaseId: "p", target: "none", deckId: "deck", resourceKey: "coins", bidMode: "second_price" });
  state.decks.deck = [{ id: "auction-card", name: "竞价奖励", effects: [] }];
  let result = executeBoardGameAction(design, state, { actionId: "sealed-bid", seatIndex: 0, bidAmount: 4 });
  assert.equal(result.ok, true);
  result = executeBoardGameAction(design, result.state, { actionId: "sealed-bid", seatIndex: 1, bidAmount: 2 });
  assert.equal(result.ok, true);
  assert.equal(result.state.playerValues[0].coins, 3);
  assert.equal(result.state.claimedCards[0][0].id, "auction-card");
  assert.equal(result.state.auctionLog[0].mode, "second_price");
  assert.equal(result.state.auctionLog[0].pricePaid, 2);
});

test("universal nested response kit resumes the outer window after inner response", () => {
  const { design, state } = fresh();
  design.engine.phases[0].actionIds = ["main-response", "first-response", "second-response"];
  design.engine.actions.push(
    { id: "main-response", label: "主行动", kind: "gain", phaseId: "p", target: "none", resourceKey: "grain", amount: 1, responseActionIds: ["first-response"], responseTimeoutSeconds: 30 },
    { id: "first-response", label: "第一层响应", kind: "gain", phaseId: "p", target: "none", resourceKey: "grain", amount: 1, responseActionIds: ["second-response"], responseTimeoutSeconds: 30 },
    { id: "second-response", label: "第二层响应", kind: "gain", phaseId: "p", target: "none", resourceKey: "grain", amount: 1, responseTimeoutSeconds: 30 }
  );
  let result = executeBoardGameAction(design, state, { actionId: "main-response", seatIndex: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.state.pendingResponseWindow.depth, 0);
  result = executeBoardGameAction(design, result.state, { actionId: "first-response", seatIndex: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.state.pendingResponseWindow.depth, 1);
  assert.equal(result.state.responseStack.length, 1);
  const projected = projectBoardGamePublicState(result.state);
  assert.equal(projected.pendingResponseWindow.depth, 1);
  assert.equal(projected.responseStack, undefined);
  result = executeBoardGameAction(design, result.state, { actionId: "second-response", seatIndex: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.state.pendingResponseWindow, null);
  assert.equal(result.state.responseStack.length, 0);
  assert.equal(result.state.resolved, true);
  assert.equal(result.state.playerValues[0].grain, 3);
  assert.equal(result.state.playerValues[1].grain, 4);
});
