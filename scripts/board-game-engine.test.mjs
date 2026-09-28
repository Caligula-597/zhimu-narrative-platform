import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceBoardGameRuntime,
  compileBoardGameEngine,
  createBoardGameRuntimeState,
  expireBoardGameResponseWindow,
  executeBoardGameAction,
  legalBoardGameTargets,
  normalizeBoardGameEngine
} from "../shared/board-game-engine.js";
import { normalizeBoardGameDesign } from "../shared/board-game-design.js";
import { createDawnRingDraftDesign } from "../shared/reference-board-game-presets.js";
import { composeBoardGameMechanisms, composeBoardGameRecipe } from "../shared/board-game-mechanism-composer.js";
import { chooseBoardGameAiDecision, projectBoardGameAiState } from "../shared/board-game-ai-policy.js";

function runnableDesign({ mode = "sequential" } = {}) {
  return normalizeBoardGameDesign({
    title: "引擎测试",
    playerCount: { min: 2, max: 2 },
    variables: [
      { id: "supply", label: "补给", scope: "player", initialValue: 3, min: 0, max: 9 },
      { id: "score", label: "分数", scope: "player", initialValue: 0, min: 0, max: 20 }
    ],
    mechanisms: [{
      id: "score-one", templateKey: "track_change", name: "加一分", sourceComponentId: "", trigger: "行动",
      conditionMode: "all", conditions: [{ id: "has-score", sourceKey: "score", operator: "gte", value: "0" }],
      effects: [{ id: "add-score", targetKey: "score", operation: "add", value: "1" }], notes: ""
    }],
    engine: {
      maxRounds: 2,
      map: {
        kind: "area_graph",
        nodes: [
          { id: "a", label: "A", x: 20, y: 50 },
          { id: "b", label: "B", x: 50, y: 50 },
          { id: "c", label: "C", x: 80, y: 50 }
        ],
        edges: [
          { id: "a-b", from: "a", to: "b", bidirectional: true },
          { id: "b-c", from: "b", to: "c", bidirectional: true }
        ]
      },
      phases: [{ id: "orders", label: "下令", mode, actionIds: ["move", "control", "score-action", "rest"] }],
      actions: [
        { id: "move", label: "移动", kind: "move", phaseId: "orders", target: "adjacent_region", resourceKey: "supply", cost: 1 },
        { id: "control", label: "控制", kind: "control", phaseId: "orders", target: "any_region", resourceKey: "supply", cost: 1 },
        { id: "score-action", label: "计分", kind: "mechanism", phaseId: "orders", target: "none", mechanismId: "score-one" },
        { id: "rest", label: "跳过", kind: "pass", phaseId: "orders", target: "none" }
      ],
      setup: { unitsPerSeat: 1, startingNodeIds: ["a", "c"] },
      endCondition: { type: "rounds", value: 2 },
      information: "public"
    }
  });
}

test("engine normalizes coordinates and declared primitives", () => {
  const engine = normalizeBoardGameEngine({
    map: { kind: "area_graph", nodes: [{ id: "a", label: "A", x: 200, y: -20 }] },
    phases: [{ id: "p", mode: "sequential", actionIds: ["pass"] }],
    actions: [{ id: "pass", label: "跳过", kind: "pass", phaseId: "p", target: "none" }]
  });
  assert.equal(engine.map.nodes[0].x, 96);
  assert.equal(engine.map.nodes[0].y, 6);
  assert.equal(engine.actions[0].kind, "pass");
});

test("compiler catches missing route and phase references", () => {
  const design = runnableDesign();
  design.engine.map.edges[0].to = "missing";
  design.engine.phases[0].actionIds.push("missing-action");
  const report = compileBoardGameEngine(design, 2);
  assert.equal(report.blocking, true);
  assert.ok(report.issues.some((item) => item.code === "ENGINE_ROUTE_NODE_MISSING"));
  assert.ok(report.issues.some((item) => item.code === "ENGINE_PHASE_ACTION_MISSING"));
});

test("legal movement targets come only from unblocked adjacent routes", () => {
  const design = runnableDesign();
  const state = createBoardGameRuntimeState(design, 2);
  assert.deepEqual(legalBoardGameTargets(design, state, "move", 0), ["b"]);
  assert.deepEqual(legalBoardGameTargets(design, state, "move", 1), ["b"]);
});

test("unowned control targets and rotating reveal order prevent last-seat overwrite", () => {
  const design = runnableDesign({ mode: "reveal" });
  design.engine.actions.find((action) => action.id === "control").target = "unowned_region";
  const state = createBoardGameRuntimeState(design, 2);
  assert.deepEqual(legalBoardGameTargets(design, state, "control", 0), ["a", "b", "c"]);
  const first = executeBoardGameAction(design, state, { actionId: "control", targetId: "b", seatIndex: 0 });
  const second = executeBoardGameAction(design, first.state, { actionId: "control", targetId: "c", seatIndex: 1 });
  assert.equal(second.ok, true);
  assert.equal(second.state.owners.b, 0);
  assert.equal(second.state.owners.c, 1);
});

test("sequential action pays cost, moves unit and advances only on explicit progress", () => {
  const design = runnableDesign();
  const state = createBoardGameRuntimeState(design, 2);
  const result = executeBoardGameAction(design, state, { actionId: "move", targetId: "b", seatIndex: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.state.units.find((unit) => unit.seatIndex === 0).nodeId, "b");
  assert.equal(result.state.playerValues[0].supply, 2);
  assert.equal(result.state.activeSeatIndex, 0);
  assert.equal(result.state.resolved, true);
  const advanced = advanceBoardGameRuntime(design, result.state);
  assert.equal(advanced.ok, true);
  assert.equal(advanced.state.activeSeatIndex, 1);
  assert.equal(advanced.state.resolved, false);
});

test("sequential actions open a timed reaction window and close only after every eligible seat responds", () => {
  const design = runnableDesign();
  const phase = design.engine.phases[0];
  phase.actionIds.push("react");
  design.engine.actions.push({ id: "react", label: "响应：放弃", kind: "pass", phaseId: phase.id, target: "none" });
  design.engine.actions.find((action) => action.id === "score-action").responseActionIds = ["react"];
  design.engine.actions.find((action) => action.id === "score-action").responseTimeoutSeconds = 5;
  design.engine.actions.find((action) => action.id === "score-action").responseDefaultActionId = "react";
  const state = createBoardGameRuntimeState(design, 2);
  const opened = executeBoardGameAction(design, state, { actionId: "score-action", targetId: "", seatIndex: 0 });
  assert.equal(opened.ok, true);
  assert.equal(opened.phaseResolved, false);
  assert.equal(opened.state.resolved, false);
  assert.equal(opened.state.activeSeatIndex, 1);
  assert.equal(opened.state.pendingResponseWindow.eligibleSeatIndexes[0], 1);
  const advancedTooEarly = advanceBoardGameRuntime(design, opened.state);
  assert.equal(advancedTooEarly.code, "RESPONSE_WINDOW_PENDING");
  const responded = executeBoardGameAction(design, opened.state, { actionId: "react", targetId: "", seatIndex: 1 });
  assert.equal(responded.ok, true);
  assert.equal(responded.phaseResolved, true);
  assert.equal(responded.state.pendingResponseWindow, null);
  assert.equal(responded.state.activeSeatIndex, 0);
});

test("expired reaction windows use the declared default response and remain synchronizable", () => {
  const design = runnableDesign();
  const phase = design.engine.phases[0];
  phase.actionIds.push("react");
  design.engine.actions.push({ id: "react", label: "响应：放弃", kind: "pass", phaseId: phase.id, target: "none" });
  const source = design.engine.actions.find((action) => action.id === "score-action");
  source.responseActionIds = ["react"];
  source.responseTimeoutSeconds = 1;
  source.responseDefaultActionId = "react";
  const state = createBoardGameRuntimeState(design, 2);
  const opened = executeBoardGameAction(design, state, { actionId: "score-action", targetId: "", seatIndex: 0 });
  const expired = expireBoardGameResponseWindow(design, opened.state, opened.state.pendingResponseWindow.deadlineAt + 1);
  assert.equal(expired.ok, true);
  assert.equal(expired.state.pendingResponseWindow, null);
  assert.equal(expired.state.resolved, true);
  assert.equal(expired.state.log.some((entry) => entry.tone === "timeout"), true);
  assert.equal(expired.state.activeSeatIndex, 0);
});

test("mechanism action writes to the active seat variable scope", () => {
  const design = runnableDesign();
  const state = createBoardGameRuntimeState(design, 2);
  const result = executeBoardGameAction(design, state, { actionId: "score-action", targetId: "", seatIndex: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.state.playerValues[0].score, 1);
  assert.equal(result.state.playerValues[1].score, 0);
});

test("card effects emit an auditable response with the real before/after value", () => {
  const design = runnableDesign();
  design.components = [{
    id: "relics", type: "deck", name: "遗物", quantity: 1, entries: [{
      id: "relic", name: "回声遗物", description: "", quantity: 1,
      effects: [{ id: "relic-score", targetKey: "score", operation: "add", value: "3" }]
    }]
  }];
  design.engine.phases[0].actionIds.push("place-relic");
  design.engine.actions.push({ id: "place-relic", label: "放置遗物", kind: "place", phaseId: "orders", target: "any_region", deckId: "relics" });
  const state = createBoardGameRuntimeState(design, 2);
  const result = executeBoardGameAction(design, state, { actionId: "place-relic", targetId: "b", seatIndex: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.state.playerValues[0].score, 3);
  assert.deepEqual(result.state.responseEvents[0], {
    id: "response-1", sourceType: "card", sourceId: "relics:relic:1", sourceLabel: "回声遗物", seatIndex: 0,
    targetScope: "self", targetSeatIndex: 0, targetKey: "score", operation: "add", before: 0, after: 3,
    visibility: "public", status: "applied", applied: true, reason: "", detail: "score add 3（0 → 3）"
  });
});

test("complex card effects honor conditions, priority timing, repetition and chained mechanisms", () => {
  const design = runnableDesign();
  design.mechanisms.push({
    id: "chain-score", name: "连锁回响", conditionMode: "all", conditions: [],
    effects: [{ id: "chain-score-effect", targetKey: "score", operation: "add", value: 2 }]
  });
  design.components = [{
    id: "complex-deck", type: "deck", name: "复杂牌堆", quantity: 1, entries: [{
      id: "complex-card", name: "连锁卡", description: "", quantity: 1,
      effects: [{
        id: "complex-effect", targetKey: "score", operation: "add", value: 1,
        repeat: 2, timing: "after_action", priority: 10, chainMechanismId: "chain-score",
        conditions: [{ sourceKey: "supply", operator: "gte", value: 0 }]
      }]
    }]
  }];
  design.engine.phases[0].actionIds.push("place-complex");
  design.engine.actions.push({ id: "place-complex", label: "放置复杂卡", kind: "place", phaseId: "orders", target: "any_region", deckId: "complex-deck" });
  const state = createBoardGameRuntimeState(design, 2);
  const result = executeBoardGameAction(design, state, { actionId: "place-complex", targetId: "b", seatIndex: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.state.playerValues[0].score, 4);
  assert.equal(result.state.effectQueue.length, 0);
  assert.ok(result.state.responseEvents.some((event) => event.status === "queued"));
  assert.equal(result.state.responseEvents.filter((event) => event.sourceId === "complex-deck:complex-card:1" && event.applied).length, 2);
  assert.ok(result.state.responseEvents.some((event) => event.sourceId === "chain-score" && event.applied));
});

test("compiler blocks card and mechanism effects that have no real target", () => {
  const design = runnableDesign();
  design.components = [{ id: "bad-deck", type: "deck", name: "坏牌堆", entries: [{ id: "bad-card", name: "坏牌", quantity: 1, effects: [{ targetKey: "missing", operation: "add", value: 1 }] }] }];
  design.mechanisms[0].effects.push({ id: "bad-effect", targetKey: "missing", operation: "add", value: 1 });
  const report = compileBoardGameEngine(design, 2);
  assert.equal(report.blocking, true);
  assert.ok(report.issues.some((item) => item.code === "ENGINE_CARD_EFFECT_VARIABLE_MISSING"));
  assert.ok(report.issues.some((item) => item.code === "ENGINE_MECHANISM_EFFECT_VARIABLE_MISSING"));
});

test("compiler blocks mechanism effects with unsupported timing", () => {
  const design = runnableDesign();
  design.mechanisms[0].effects[0].timing = "after_everything";
  const report = compileBoardGameEngine(design);
  assert.ok(report.issues.some((item) => item.code === "ENGINE_MECHANISM_EFFECT_TIMING_INVALID"));
});

test("public vote effects do not accidentally resolve into seat zero", () => {
  const design = runnableDesign({ mode: "reveal" });
  design.mechanisms.push({
    id: "vote-bonus", name: "通过奖励", conditionMode: "all", conditions: [],
    effects: [{ id: "vote-score", targetKey: "score", operation: "add", value: 2 }]
  });
  design.engine.phases[0].votePassMechanismId = "vote-bonus";
  design.engine.phases[0].actionIds = ["yes", "no"];
  design.engine.actions = [
    { id: "yes", label: "支持", kind: "vote", amount: 1, phaseId: "orders", target: "none" },
    { id: "no", label: "反对", kind: "vote", amount: -1, phaseId: "orders", target: "none" }
  ];
  const initial = createBoardGameRuntimeState(design, 2);
  const first = executeBoardGameAction(design, initial, { actionId: "yes", seatIndex: 0 });
  const second = executeBoardGameAction(design, first.state, { actionId: "yes", seatIndex: 1 });
  assert.equal(second.ok, true);
  assert.deepEqual(second.state.playerValues.map((values) => values.score), [3, 3]);
  assert.deepEqual(second.state.responseEvents.filter((event) => event.sourceId === "vote-bonus").map((event) => event.targetSeatIndex).sort(), [0, 1]);
});

test("reveal phase waits for every seat before applying submissions", () => {
  const design = runnableDesign({ mode: "reveal" });
  const initial = createBoardGameRuntimeState(design, 2);
  const first = executeBoardGameAction(design, initial, { actionId: "control", targetId: "b", seatIndex: 0 });
  assert.equal(first.ok, true);
  assert.equal(first.phaseResolved, false);
  assert.equal(first.state.owners.b, null);
  assert.equal(first.state.activeSeatIndex, 1);
  const second = executeBoardGameAction(design, first.state, { actionId: "rest", targetId: "", seatIndex: 1 });
  assert.equal(second.ok, true);
  assert.equal(second.phaseResolved, true);
  assert.equal(second.state.owners.b, 0);
});

test("reveal primitives compile as runnable demos with explicit visibility", () => {
  const design = runnableDesign();
  design.engine.actions[0].kind = "reveal";
  design.engine.actions[0].deckId = "reveal-deck";
  design.components = [{ id: "reveal-deck", type: "deck", entries: [{ id: "reveal-card", name: "可见牌", quantity: 1 }] }];
  design.engine.actions[0].revealVisibility = "team";
  const report = compileBoardGameEngine(design, 2);
  assert.equal(report.blocking, false);
  assert.equal(report.capabilities.runnable, true);
});

test("hand draft deals private cards, passes leftovers and changes direction between ages", () => {
  const design = createDawnRingDraftDesign();
  const report = compileBoardGameEngine(design, 3);
  assert.equal(report.blocking, false);
  const initial = createBoardGameRuntimeState(design, 3);
  assert.equal(initial.hands.every((hand) => hand.length === 7), true);
  assert.deepEqual(initial.playerValues.map((values) => values.energy || values.trade || values.science || values.military || values.coins), [1, 1, 1,]);
  const action = design.engine.actions[0];
  const picks = initial.hands.map((hand) => hand[0].id);
  let state = initial;
  for (let seatIndex = 0; seatIndex < 3; seatIndex += 1) {
    const result = executeBoardGameAction(design, state, { actionId: action.id, seatIndex, cardId: picks[seatIndex] });
    assert.equal(result.ok, true);
    state = result.state;
  }
  assert.equal(state.resolved, true);
  assert.equal(state.hands.every((hand) => hand.length === 6), true);
  assert.equal(state.claimedCards.every((cards) => cards.length === 1), true);
  const advanced = advanceBoardGameRuntime(design, state);
  assert.equal(advanced.ok, true);
  assert.equal(advanced.state.draftTurn, 2);
  assert.equal(advanced.state.draftDirection, "right");
});

test("mechanism composer allows cross-domain recipes and blocks missing prerequisites", () => {
  const recipe = composeBoardGameRecipe("city-engine-draft");
  assert.equal(recipe.ready, true);
  assert.ok(recipe.axes.includes("timing"));
  assert.ok(recipe.axes.includes("resource"));
  assert.ok(recipe.axes.includes("ai"));
  const incomplete = composeBoardGameMechanisms(["draft.hand"]);
  assert.equal(incomplete.ready, false);
  assert.ok(incomplete.issues.some((item) => item.code === "MODULE_REQUIREMENT_MISSING"));
});

test("commercial mechanism extracts compose into auditable online recipes", () => {
  const deckCity = composeBoardGameRecipe("deck-city");
  assert.equal(deckCity.ready, true);
  assert.equal(deckCity.implementationStatus, "partial");
  assert.ok(deckCity.capabilities.includes("deck.personal"));
  assert.ok(deckCity.capabilities.includes("engine.tableau"));

  const expedition = composeBoardGameRecipe("expedition-network");
  assert.equal(expedition.ready, true);
  assert.ok(expedition.capabilities.includes("objective.private"));
  assert.ok(expedition.capabilities.includes("objective.destination"));

  const missingRoutePrerequisite = composeBoardGameMechanisms(["route.destination", "objective.hidden"]);
  assert.equal(missingRoutePrerequisite.ready, false);
  assert.ok(missingRoutePrerequisite.issues.some((item) => item.code === "MODULE_REQUIREMENT_MISSING"));
});

test("AI playtest policy evaluates a full private hand without foreign-hand leakage", () => {
  const design = createDawnRingDraftDesign();
  const state = createBoardGameRuntimeState(design, 3);
  state.hands[1] = [{ id: "foreign-secret", name: "不应被读取", effects: [{ targetKey: "score", operation: "add", value: 999 }] }];
  const projected = projectBoardGameAiState(state, 0);
  assert.equal(projected.hands[1].length, 0);
  assert.equal(projected.hands[2].length, 0);
  const decision = chooseBoardGameAiDecision(design, state, 0, { profile: "builder" });
  assert.equal(decision.ok, true);
  assert.equal(decision.candidateCount, state.hands[0].length);
  assert.ok(state.hands[0].some((card) => card.id === decision.cardId));

  const sequentialDesign = structuredClone(design);
  sequentialDesign.engine.phases[0].mode = "sequential";
  const sequentialState = createBoardGameRuntimeState(sequentialDesign, 3);
  const searchedDecision = chooseBoardGameAiDecision(sequentialDesign, sequentialState, 0, { profile: "builder", searchDepth: 2, maxSearchCandidates: 10 });
  assert.equal(searchedDecision.ok, true);
  assert.equal(searchedDecision.searchDepth, 2);
  assert.ok(searchedDecision.searchNodes > 0);
});
