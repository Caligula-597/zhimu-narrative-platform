import assert from "node:assert/strict";
import test from "node:test";
import { applyBoardGameAiCandidate, createBoardGameAiDraftPreview, detectedUnsupportedBoardGameRequirements } from "../shared/board-game-ai-draft.js";
import { normalizeBoardGameDesign } from "../shared/board-game-design.js";

function candidate() {
  return {
    title: "候选",
    designGoal: "区域移动与计分",
    playerCount: { min: 2, max: 4 },
    components: [{ id: "board", type: "board", name: "地图", quantity: 1, stateFields: [], assets: [], entries: [] }],
    variables: [{ id: "score", label: "分数", scope: "player", initialValue: 0, min: 0, max: 20 }],
    mechanisms: [{ id: "score-one", templateKey: "track_change", name: "计分", sourceComponentId: "board", conditionMode: "all", conditions: [{ id: "c", sourceKey: "score", operator: "gte", value: "0" }], effects: [{ id: "e", targetKey: "score", operation: "add", value: "1" }] }],
    engine: {
      map: { kind: "area_graph", nodes: [{ id: "a", label: "A", x: 20, y: 50 }, { id: "b", label: "B", x: 80, y: 50 }], edges: [{ id: "a-b", from: "a", to: "b", bidirectional: true }] },
      phases: [{ id: "turn", label: "行动", mode: "sequential", actionIds: ["move", "score-action"] }],
      actions: [{ id: "move", label: "移动", kind: "move", phaseId: "turn", target: "adjacent_region" }, { id: "score-action", label: "计分", kind: "mechanism", phaseId: "turn", target: "none", mechanismId: "score-one" }],
      setup: { unitsPerSeat: 1, startingNodeIds: ["a", "b"] }, endCondition: { type: "rounds", value: 3 }, information: "public"
    },
    rulebook: { objective: "三轮后高分者胜", setup: "放置单位", turnStructure: "依次行动", playerActions: "移动或计分", endCondition: "三轮后结束", tieBreak: "剩余资源", notes: "" }
  };
}

test("AI missing mode fills engine without replacing authored goal", () => {
  const current = normalizeBoardGameDesign({ title: "原项目", designGoal: "作者目标" });
  const next = applyBoardGameAiCandidate(current, candidate(), { scope: "missing" });
  assert.equal(next.designGoal, "作者目标");
  assert.equal(next.engine.map.nodes.length, 2);
});

test("AI patch mode returns a complete modified design", () => {
  const current = normalizeBoardGameDesign(candidate());
  const changed = candidate(); changed.engine.actions[0].label = "快速移动";
  const next = applyBoardGameAiCandidate(current, changed, { scope: "patch" });
  assert.equal(next.engine.actions[0].label, "快速移动");
  assert.equal(next.components[0].id, "board");
});

test("AI preview blocks non-runnable engine references", () => {
  const valid = createBoardGameAiDraftPreview({}, candidate(), { scope: "full" });
  assert.equal(valid.blocking, false);
  const broken = candidate(); broken.engine.map.edges[0].to = "missing";
  const invalid = createBoardGameAiDraftPreview({}, broken, { scope: "full" });
  assert.equal(invalid.blocking, true);
  assert.ok(invalid.issues.some((item) => item.code === "ENGINE_ROUTE_NODE_MISSING"));
});

test("request capability scan identifies features the V1 demo cannot execute", () => {
  const unsupported = detectedUnsupportedBoardGameRequirements("加入手牌管理、公开竞价和掷骰移动");
  assert.deepEqual(unsupported.map((item) => item.capabilityId), ["action.bid", "action.draw", "random.seeded"]);
});
