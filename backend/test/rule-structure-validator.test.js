import assert from "node:assert/strict";
import test from "node:test";
import { validateRuleBody } from "../src/rule-structure-validator.js";

const snapshot = {
  roles: [{ id: "role-1", name: "顾言" }],
  sections: [{ id: "sec-1", role_slot_id: "role-1" }, { id: "sec-2", role_slot_id: "role-1" }],
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

test("validateRuleBody rejects unsupported condition container", () => {
  const result = validateRuleBody(snapshot, {
    conditions: { any: [{ type: "reading_completed", roleSlotId: "role-1", scriptSectionId: "sec-1" }] },
    actions: [{ type: "timeline_log", message: "ok" }]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors[0].message.includes("conditions.all"));
});
