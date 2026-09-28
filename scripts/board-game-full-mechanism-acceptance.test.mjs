import assert from "node:assert/strict";
import test from "node:test";
import {
  assessBoardGameEngineCapabilities,
  compileBoardGameEngine,
  createBoardGameRuntimeState,
  executeBoardGameAction,
  advanceBoardGameRuntime
} from "../shared/board-game-engine.js";
import { cleanupBoardGameEra } from "../shared/board-game-advanced-primitives.js";
import { createBoardGameOnlineSnapshot } from "../shared/board-game-online-runtime.js";

function acceptanceDesign(overrides = {}) {
  return {
    title: "全机制验收夹具",
    playerCount: { min: 3, max: 3 },
    variables: [
      { id: "wood", label: "木材", scope: "player", initialValue: 4, min: 0, max: 99 },
      { id: "score", label: "分数", scope: "player", initialValue: 2, min: 0, max: 999 },
      { id: "damage", label: "损伤", scope: "player", initialValue: 0, min: 0, max: 99 },
      { id: "globalThreat", label: "公共威胁", scope: "global", initialValue: 0, min: 0, max: 99 }
    ],
    mechanisms: [],
    components: [{
      id: "reveal-deck",
      type: "deck",
      name: "揭示牌",
      quantity: 1,
      entries: [
        { id: "red-secret", name: "红队密报", quantity: 1, age: 1 },
        { id: "blue-secret", name: "蓝队密报", quantity: 1, age: 1 },
        { id: "public-sign", name: "公共信号", quantity: 1, age: 2 }
      ]
    }],
    engine: {
      maxRounds: 1,
      map: { kind: "area_graph", nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ id: "a-b", from: "a", to: "b", bidirectional: true }] },
      phases: [{ id: "p", label: "验收阶段", mode: "sequential", actionIds: ["reveal-team", "roll", "pass"] }],
      actions: [
        { id: "reveal-team", label: "团队揭示", kind: "reveal", phaseId: "p", target: "none", deckId: "reveal-deck", revealVisibility: "team" },
        { id: "roll", label: "骰点生产", kind: "roll", phaseId: "p", target: "none", rollCount: 2, rollSides: 2, productionRules: [
          { min: 2, max: 2, variableKey: "wood", amount: 2, scope: "self" },
          { min: 3, max: 99, variableKey: "globalThreat", amount: 1, scope: "all_players" }
        ] },
        { id: "pass", label: "跳过", kind: "pass", phaseId: "p", target: "none", cooldownRounds: 2 }
      ],
      setup: {
        unitsPerSeat: 1,
        startingNodeIds: ["a", "b"],
        teamAssignments: ["red", "red", "blue"],
        actionTrack: { enabled: true, actionIds: ["reveal-team", "roll", "pass"], jumpResourceKey: "wood", jumpCostPerStep: 1 },
        endgameMultipliers: [{ id: "double-score", variableKey: "wood", operator: "gte", value: 4, multiplier: 2, points: 1 }],
        hiddenObjectives: [{ id: "wood-objective", label: "保有木材", variableKey: "wood", operator: "gte", value: 4, points: 3 }],
        eraCleanup: { everyRounds: 1, deckIds: ["reveal-deck"], discardMarket: true, zones: ["decks", "market", "hands", "tableaus"], migrateToAge: null }
      },
      endCondition: { type: "rounds", value: 1 },
      information: "team"
    },
    ...overrides
  };
}

test("all registered engine capabilities compile without partial gates", () => {
  const design = acceptanceDesign();
  const report = compileBoardGameEngine(design, 3);
  assert.equal(report.blocking, false, report.issues.map((item) => item.message).join("; "));
  assert.equal(report.capabilities.partial, 0);
  assert.equal(report.capabilities.unsupported, 0);
  assert.equal(report.capabilities.runnable, true);
  assert.equal(assessBoardGameEngineCapabilities(design.engine).runnable, true);
});

test("team reveal is visible to the same team and absent from public and foreign-team projections", () => {
  const design = acceptanceDesign();
  let state = createBoardGameRuntimeState(design, 3);
  const card = state.decks["reveal-deck"].at(-1);
  const result = executeBoardGameAction(design, state, { actionId: "reveal-team", seatIndex: 0 });
  assert.equal(result.ok, true);
  state = result.state;
  const snapshot = createBoardGameOnlineSnapshot(design, state);
  assert.equal(snapshot.publicState.revealed.some((item) => item.id === card.id), false);
  assert.equal(snapshot.publicState.teamRevealed, undefined);
  assert.ok(snapshot.viewerStates[0].viewer.revealed.some((item) => item.id === card.id));
  assert.ok(snapshot.viewerStates[1].viewer.revealed.some((item) => item.id === card.id));
  assert.equal(snapshot.viewerStates[2].viewer.revealed.some((item) => item.id === card.id), false);
  assert.equal(snapshot.viewerStates[0].responseEvents.some((item) => item.visibility === "team"), true);
  assert.equal(snapshot.viewerStates[2].responseEvents.some((item) => item.visibility === "team"), false);
});

test("dice production records exact rolls and applies scoped positive and disaster outputs deterministically", () => {
  const design = acceptanceDesign();
  const left = createBoardGameRuntimeState(design, 3);
  const right = createBoardGameRuntimeState(design, 3);
  const leftResult = executeBoardGameAction(design, left, { actionId: "roll", seatIndex: 0 });
  const rightResult = executeBoardGameAction(design, right, { actionId: "roll", seatIndex: 0 });
  assert.equal(leftResult.ok, true);
  assert.deepEqual(leftResult.state.dice, rightResult.state.dice);
  assert.deepEqual(leftResult.state.diceHistory[0].rolls, leftResult.state.dice);
  assert.equal(leftResult.state.diceHistory[0].actionId, "roll");
  assert.equal(leftResult.state.playerValues[0].wood >= 4, true);
  assert.equal(leftResult.state.playerValues.every((values) => values.wood >= 4), true);
});

test("action track charges jump payment and cooldown blocks repeat until round decay", () => {
  const design = acceptanceDesign();
  let state = createBoardGameRuntimeState(design, 3);
  const result = executeBoardGameAction(design, state, { actionId: "pass", seatIndex: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.state.playerValues[0].wood, 3);
  result.state.resolved = false;
  const blocked = executeBoardGameAction(design, result.state, { actionId: "pass", seatIndex: 0 });
  assert.equal(blocked.code, "ACTION_COOLDOWN");
});

test("era cleanup and finalized end audit include objective, multiplier, ranking and winner", () => {
  const design = acceptanceDesign();
  let state = createBoardGameRuntimeState(design, 3);
  state.market = [{ id: "old-market", age: 1, deckId: "reveal-deck" }];
  state.hands[0] = [{ id: "old-hand", age: 1 }];
  state.tableaus[0] = [{ id: "old-tableau", age: 1 }];
  const moved = cleanupBoardGameEra(state, { deckIds: ["reveal-deck"], discardMarket: true, zones: ["decks", "market", "hands", "tableaus"], era: 2 });
  assert.ok(moved.length >= 4);
  state.resolved = true;
  state.activeSeatIndex = 2;
  const advanced = advanceBoardGameRuntime(design, state);
  assert.equal(advanced.ok, true);
  assert.equal(advanced.state.ended, true);
  const audit = advanced.state.endAudit.at(-1) || advanced.state.endAudit[0];
  assert.equal(audit.finalized, true);
  assert.ok(Array.isArray(audit.ranking));
  assert.ok(Array.isArray(audit.winnerSeatIndexes));
  assert.ok(audit.multipliers.some((item) => item.passed));
  assert.ok(advanced.state.scores.every((score) => score >= 5));
});
