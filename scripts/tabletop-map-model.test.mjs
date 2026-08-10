import assert from "node:assert/strict";
import test from "node:test";
import {
  TABLETOP_MAP_SCHEMA_VERSION,
  createDefaultMapDesign,
  evaluateEndings,
  normalizeMapDesign
} from "../src/views/tabletop-map-model.js";

test("new maps provide an editable canvas and variables without prewritten endings", () => {
  const design = createDefaultMapDesign();
  assert.equal(design.schemaVersion, TABLETOP_MAP_SCHEMA_VERSION);
  assert.equal(design.canvas.mode, "template");
  assert.equal(design.canvas.gridType, "square");
  assert.equal(design.locations.length, 6);
  assert.equal(design.routes.length, 7);
  assert.equal(design.system.dice.sides, 20);
  assert.ok(design.system.npcs.length >= 1);
  assert.ok(design.locations.some((location) => location.encounterNpcIds.length));
  assert.deepEqual(design.variables.map(({ id, value }) => ({ id, value })), [
    { id: "evidence", value: 62 },
    { id: "threat", value: 48 },
    { id: "bond", value: 71 }
  ]);
  assert.deepEqual(design.endings, []);
  assert.equal(evaluateEndings(design).likely, null);
});

test("schema v1 values and requirements migrate into creator variables and all conditions", () => {
  const migrated = normalizeMapDesign({
    schemaVersion: 1,
    title: "旧地图",
    values: { evidence: 78, threat: 32, bond: 54 },
    endings: [{
      id: "dawn-truth",
      name: "破晓真相",
      requirements: [
        { key: "evidence", operator: ">=", value: 70 },
        { key: "threat", operator: "<=", value: 40 }
      ]
    }]
  });
  assert.equal(migrated.schemaVersion, TABLETOP_MAP_SCHEMA_VERSION);
  assert.equal(migrated.variables.find((item) => item.id === "evidence")?.value, 78);
  assert.equal(migrated.endings[0].logic, "all");
  assert.deepEqual(migrated.endings[0].conditions.map(({ variableId, operator, value }) => ({ variableId, operator, value })), [
    { variableId: "evidence", operator: ">=", value: 70 },
    { variableId: "threat", operator: "<=", value: 40 }
  ]);
  assert.equal(evaluateEndings(migrated).likely?.id, "dawn-truth");
  assert.equal(evaluateEndings(migrated).likely?.eligible, true);
});

test("ending evaluator supports OR groups and resolves simultaneous matches by priority", () => {
  const design = normalizeMapDesign({
    ...createDefaultMapDesign(),
    variables: [
      { id: "sanity", label: "理智", min: 0, max: 120, value: 25, color: "#5f78b8" },
      { id: "infection", label: "感染", min: 0, max: 10, value: 8, color: "#d65f52" }
    ],
    endings: [
      {
        id: "escape",
        name: "撤离",
        priority: 2,
        logic: "any",
        conditions: [
          { id: "a", variableId: "sanity", operator: "<=", value: 30 },
          { id: "b", variableId: "infection", operator: ">=", value: 9 }
        ]
      },
      {
        id: "collapse",
        name: "失控",
        priority: 8,
        logic: "all",
        conditions: [{ id: "c", variableId: "infection", operator: ">=", value: 8 }]
      }
    ]
  });
  const evaluation = evaluateEndings(design);
  assert.equal(evaluation.results.find((item) => item.id === "escape")?.eligible, true);
  assert.equal(evaluation.results.find((item) => item.id === "collapse")?.eligible, true);
  assert.equal(evaluation.likely?.id, "collapse");
});

test("normalization clamps custom ranges, prunes unknown effects and removes invalid routes", () => {
  const design = createDefaultMapDesign();
  const normalized = normalizeMapDesign({
    ...design,
    variables: [{ id: "time", label: "时间", min: -5, max: 12, value: 80, color: "bad" }],
    locations: design.locations.map((location) => ({ ...location, effects: { time: 99, unknown: 4 } })),
    routes: [["clock-archive", "clock-archive"], ["missing", "mist-pier"], ["clock-archive", "mist-pier"]]
  });
  assert.equal(normalized.variables[0].value, 12);
  assert.equal(normalized.variables[0].color, "#3d8b6d");
  assert.deepEqual(normalized.locations[0].effects, { time: 17 });
  assert.deepEqual(normalized.routes, [["clock-archive", "mist-pier"]]);
});

test("an ending without conditions never auto-triggers", () => {
  const design = normalizeMapDesign({
    ...createDefaultMapDesign(),
    endings: [{ id: "open", name: "开放结局", logic: "all", conditions: [] }]
  });
  const evaluation = evaluateEndings(design);
  assert.equal(evaluation.results[0].eligible, false);
  assert.equal(evaluation.results[0].readiness, 0);
});

test("new map inherits the tabletop system configured while creating the world", () => {
  const design = normalizeMapDesign({}, {
    system: {
      dice: { count: 2, sides: 10, modifier: 1, defaultTarget: 14 },
      npcs: [{ id: "keeper", name: "守门人", maxHp: 16, hp: 16, attack: 4, defense: 3, damage: 5 }]
    }
  });
  assert.deepEqual(design.system.dice, { count: 2, sides: 10, modifier: 1, defaultTarget: 14 });
  assert.equal(design.system.npcs[0].name, "守门人");
});

test("location encounters keep only NPCs that still exist in the world", () => {
  const design = normalizeMapDesign({
    system: {
      players: [{ id: "pc", name: "玩家" }],
      npcs: [{ id: "keeper", name: "守门人" }]
    },
    locations: [{
      id: "gate",
      name: "城门",
      encounterNpcIds: ["keeper", "deleted-npc"]
    }]
  });
  assert.deepEqual(design.locations[0].encounterNpcIds, ["keeper"]);
});
