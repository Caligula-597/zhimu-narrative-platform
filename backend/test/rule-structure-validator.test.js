import assert from "node:assert/strict";
import test from "node:test";
import { validateRuleBody } from "../src/rule-structure-validator.js";

const snapshot = {
  roles: [{ id: "role-1", name: "顾言" }, { id: "role-2", name: "林岚" }],
  sections: [
    { id: "sec-1", role_slot_id: "role-1" },
    { id: "sec-2", role_slot_id: "role-1" },
    { id: "sec-3", role_slot_id: "role-2" }
  ],
  scenes: [{ id: "scene-1", name: "档案馆" }],
  clues: [{ id: "clue-1", name: "航运录" }],
  investigationPoints: [{ id: "point-1", name: "旧报架" }],
  items: [{ id: "item-1", name: "钥匙" }]
};

test("validateRuleBody accepts reading unlock rule", () => {
  const result = validateRuleBody(snapshot, {
    conditions: {
      all: [{ type: "reading_completed", roleSlotId: "role-1", scriptSectionId: "sec-1" }]
    },
    actions: [{ type: "unlock_script_section", scriptSectionId: "sec-2" }]
  });
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test("validateRuleBody rejects a reading section owned by another role", () => {
  const result = validateRuleBody(snapshot, {
    conditions: {
      all: [{ type: "reading_completed", roleSlotId: "role-1", scriptSectionId: "sec-3" }]
    },
    actions: [{ type: "timeline_log", message: "不应触发" }]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.message.includes("分幕不属于所选角色")));
});

test("validateRuleBody accepts investigation host confirm grant clue flow", () => {
  const result = validateRuleBody(snapshot, {
    conditions: {
      all: [{ type: "investigation_completed", investigationPointId: "point-1" }]
    },
    actions: [{ type: "grant_clue", roleSlotId: "role-1", clueId: "clue-1" }]
  });
  assert.equal(result.ok, true);
});

test("validateRuleBody reports human-readable missing clue reference", () => {
  const result = validateRuleBody(snapshot, {
    conditions: {
      all: [{ type: "clue_owned", roleSlotId: "role-1", clueId: "" }]
    },
    actions: [{ type: "unlock_scene", sceneId: "missing-scene" }]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.message.includes("条件 1") && item.message.includes("clueId")));
  assert.ok(result.errors.some((item) => item.message.includes("动作 1") && item.message.includes("场景不存在")));
});

test("validateRuleBody accepts grant_item action", () => {
  const result = validateRuleBody(snapshot, {
    conditions: {
      all: [{ type: "item_owned", roleSlotId: "role-1", itemId: "item-1" }]
    },
    actions: [{ type: "grant_item", roleSlotId: "role-1", itemId: "item-1", quantity: 1 }]
  });
  assert.equal(result.ok, true);
});

test("validateRuleBody rejects mixed condition container", () => {
  const result = validateRuleBody(snapshot, {
    conditions: {
      all: [{ type: "reading_completed", roleSlotId: "role-1", scriptSectionId: "sec-1" }],
      any: [{ type: "item_owned", roleSlotId: "role-1", itemId: "item-1" }]
    },
    actions: [{ type: "timeline_log", message: "ok" }]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors[0].message.includes("不可混用"));
});

test("validateRuleBody accepts any group and variable_compare", () => {
  const result = validateRuleBody(snapshot, {
    conditions: {
      any: [
        { type: "item_owned", roleSlotId: "role-1", itemId: "item-1" },
        { type: "variable_compare", roleSlotId: "role-1", key: "trust", operator: "gte", value: 2 }
      ]
    },
    actions: [{ type: "timeline_log", message: "ok" }]
  });
  assert.equal(result.ok, true);
});

test("validateRuleBody bounds condition depth and node count", () => {
  let nested = { type: "item_owned", roleSlotId: "role-1", itemId: "item-1" };
  for (let index = 0; index < 13; index += 1) nested = { not: nested };
  const tooDeep = validateRuleBody(snapshot, {
    conditions: nested,
    actions: [{ type: "timeline_log", message: "ok" }]
  });
  assert.equal(tooDeep.ok, false);
  assert.ok(tooDeep.errors.some((item) => item.message.includes("不能超过 12 层")));

  const tooWide = validateRuleBody(snapshot, {
    conditions: {
      any: Array.from({ length: 201 }, () => ({
        type: "item_owned",
        roleSlotId: "role-1",
        itemId: "item-1"
      }))
    },
    actions: [{ type: "timeline_log", message: "ok" }]
  });
  assert.equal(tooWide.ok, false);
  assert.ok(tooWide.errors.some((item) => item.message.includes("最多包含 200 个条件节点")));
});
