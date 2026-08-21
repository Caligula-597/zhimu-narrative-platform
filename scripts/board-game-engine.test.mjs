import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceBoardGameRuntime,
  compileBoardGameEngine,
  createBoardGameRuntimeState,
  executeBoardGameAction,
  legalBoardGameTargets,
  normalizeBoardGameEngine
} from "../shared/board-game-engine.js";
import { normalizeBoardGameDesign } from "../shared/board-game-design.js";

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

test("mechanism action writes to the active seat variable scope", () => {
  const design = runnableDesign();
  const state = createBoardGameRuntimeState(design, 2);
  const result = executeBoardGameAction(design, state, { actionId: "score-action", targetId: "", seatIndex: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.state.playerValues[0].score, 1);
  assert.equal(result.state.playerValues[1].score, 0);
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

test("partially implemented primitives are rejected as runnable demos", () => {
  const design = runnableDesign();
  design.engine.actions[0].kind = "bid";
  const report = compileBoardGameEngine(design, 2);
  assert.equal(report.blocking, true);
  assert.ok(report.issues.some((item) => item.code === "CAPABILITY_PARTIAL"));
});
