import assert from "node:assert/strict";
import test from "node:test";

const storage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};

globalThis.window = {
  zhimuState: {},
  zhimuWorkspace: {},
  localStorage: storage,
  sessionStorage: storage,
  location: { hostname: "localhost", port: "4173" }
};
globalThis.localStorage = storage;
globalThis.sessionStorage = storage;
globalThis.document = {
  querySelector: () => null,
  createElement: () => ({ className: "", textContent: "", style: {}, classList: { add: () => {}, remove: () => {} } })
};

const { worldStore } = await import("../src/state/index.js");
const { clueDependencyEdges, clueGraph, clueGraphMetrics } = await import("../src/views/clue-flow-view.js");

const clues = [
  { id: "clue-a", name: "A" },
  { id: "clue-b", name: "B" }
];

test.beforeEach(() => worldStore.set({ cloudRules: [] }));

test("stored clue relation remains directional and is not mirrored", () => {
  const edges = clueDependencyEdges({
    clues,
    investigationPoints: [],
    edges: [{ from_type: "clue", from_id: "clue-a", to_type: "clue", to_id: "clue-b", relation_type: "leads_to" }]
  });

  assert.deepEqual(edges.map(({ from, to, kind }) => ({ from, to, kind })), [
    { from: "clue-a", to: "clue-b", kind: "story" }
  ]);
});

test("unsequenced investigation points do not invent an order", () => {
  const edges = clueDependencyEdges({
    clues,
    edges: [],
    investigationPoints: [
      { id: "point-a", scene_id: "scene-1", clue_id: "clue-a", name: "甲", sequence: null },
      { id: "point-b", scene_id: "scene-1", clue_id: "clue-b", name: "乙" }
    ]
  });

  assert.equal(edges.length, 0);
});

test("explicit investigation sequence creates one forward dependency", () => {
  const edges = clueDependencyEdges({
    clues,
    edges: [],
    investigationPoints: [
      { id: "point-a", scene_id: "scene-1", clue_id: "clue-a", name: "甲", sequence: 1 },
      { id: "point-b", scene_id: "scene-1", clue_id: "clue-b", name: "乙", sequence: 2 }
    ]
  });

  assert.deepEqual(edges.map(({ from, to, kind }) => ({ from, to, kind })), [
    { from: "clue-a", to: "clue-b", kind: "investigation" }
  ]);
});

test("small clue graphs use an adaptive canvas with a usable minimum", () => {
  assert.deepEqual(clueGraphMetrics(2, 1, 2), { width: 1080, height: 768 });
  assert.deepEqual(clueGraphMetrics(24, 4, 6), { width: 1460, height: 1032 });
});

test("investigation placement alone is not reported as a connected clue path", () => {
  const html = clueGraph(clues, {
    clues,
    edges: [],
    chapters: [],
    scenes: [],
    investigationPoints: [
      { id: "point-a", scene_id: "scene-1", clue_id: "clue-a" },
      { id: "point-b", scene_id: "scene-2", clue_id: "clue-b" }
    ]
  }, "");

  assert.match(html, /<b>2<\/b> 无路径线索/);
  assert.equal((html.match(/clue-flow-node[^\"]* orphan/g) || []).length, 2);
});
