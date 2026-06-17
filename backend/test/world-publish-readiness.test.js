import assert from "node:assert/strict";
import test from "node:test";
import { evaluateWorldPublishReadiness, creatorChecks } from "../src/world-publish-readiness.js";

function minimalSnapshot(overrides = {}) {
  return {
    world: { id: "w1", name: "测试剧本", summary: "" },
    roles: [{ id: "r1", name: "角色A", sequence: 1 }],
    sections: [
      {
        id: "s1",
        role_slot_id: "r1",
        title: "第一幕",
        body: "正文内容",
        publication_status: "testing"
      }
    ],
    chapters: [{ id: "c1", title: "序章", sequence: 1 }],
    scenes: [{ id: "sc1", name: "起始场景" }],
    clues: [{ id: "cl1", name: "线索A" }],
    investigationPoints: [{ id: "p1", name: "调查点", clue_id: "cl1", result_text: "发现线索" }],
    items: [],
    edges: [],
    rules: [],
    rooms: [{ id: "room1", name: "测试房", invite_code: "TEST-1" }],
    ...overrides
  };
}

test("evaluateWorldPublishReadiness passes minimal complete snapshot", () => {
  const result = evaluateWorldPublishReadiness(minimalSnapshot());
  assert.equal(result.summary.errorCount, 0);
  assert.equal(result.summary.readyForPlaytest, true);
  assert.equal(result.summary.readyForCatalog, true);
  assert.ok(result.checks.some((item) => item.level === "success"));
});

test("evaluateWorldPublishReadiness flags missing roles and empty body", () => {
  const result = evaluateWorldPublishReadiness(
    minimalSnapshot({
      roles: [],
      sections: [],
      chapters: [],
      rooms: []
    })
  );
  assert.ok(result.summary.errorCount >= 2);
  assert.equal(result.summary.readyForPlaytest, false);
  assert.ok(result.checks.some((item) => item.id === "roles.missing"));
});

test("evaluateWorldPublishReadiness warns when no test room", () => {
  const result = evaluateWorldPublishReadiness(minimalSnapshot({ rooms: [] }));
  assert.ok(result.checks.some((item) => item.id === "rooms.missing"));
  assert.equal(result.summary.readyForPlaytest, true);
  assert.equal(result.summary.readyForCatalog, false);
});

test("creatorChecks returns legacy flat shape", () => {
  const flat = creatorChecks(minimalSnapshot({ rooms: [] }));
  assert.ok(flat.every((item) => item.level && item.title && item.detail));
  assert.ok(!flat[0].id, "legacy checks omit id field");
});

test("evaluateWorldPublishReadiness flags unreachable clues", () => {
  const result = evaluateWorldPublishReadiness(
    minimalSnapshot({
      clues: [{ id: "cl1", name: "孤立线索" }],
      investigationPoints: []
    })
  );
  assert.ok(result.checks.some((item) => item.id === "clues.cl1.unreachable"));
});
