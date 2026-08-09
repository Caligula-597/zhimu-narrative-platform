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
        sequence: 1,
        metadata: { chapterKey: "ch1" },
        publication_status: "testing"
      }
    ],
    chapters: [{ id: "c1", title: "序章", sequence: 1, metadata: { proposalKey: "ch1" } }],
    segments: [
      {
        id: "seg1",
        segment_key: "ch1",
        title: "序章",
        sequence: 1,
        story: {
          beatPlan: {
            goal: "确认第一幕冲突",
            playerContent: "阅读证词并交换公开信息",
            dmTasks: "引导玩家比较两份证词",
            advanceCondition: "全员完成第一幕讨论"
          }
        },
        operations: {
          schemaVersion: 1,
          flow: "主持流程",
          hostTruth: "主持真相",
          clueGrants: [{ clueId: "cl1", when: "开场后" }]
        }
      }
    ],
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

test("evaluateWorldPublishReadiness flags segment gaps", () => {
  const result = evaluateWorldPublishReadiness(
    minimalSnapshot({
      segments: [{ id: "seg1", segment_key: "other", title: "错位段落", sequence: 1, operations: {} }]
    })
  );
  assert.ok(result.checks.some((item) => item.id === "segments.ch1.chapter_unlinked"));
  assert.ok(result.checks.some((item) => item.id === "segments.ch1.section_unlinked"));
  assert.ok(result.checks.some((item) => item.id === "segments.other.runbook_missing"));
});

test("evaluateWorldPublishReadiness warns about incomplete beat plans without blocking playtest", () => {
  const snapshot = minimalSnapshot();
  snapshot.segments[0].story.beatPlan = {
    goal: "确认第一幕冲突",
    playerContent: "阅读证词"
  };
  const result = evaluateWorldPublishReadiness(snapshot);
  const warning = result.checks.find((item) => item.id === "segments.ch1.beat_plan_incomplete");
  assert.equal(warning?.level, "warning");
  assert.match(warning?.detail || "", /主持任务/);
  assert.match(warning?.detail || "", /推进条件/);
  assert.equal(result.summary.readyForPlaytest, true);
});

test("evaluateWorldPublishReadiness reports a missing beat plan as one actionable warning", () => {
  const snapshot = minimalSnapshot();
  delete snapshot.segments[0].story;
  const result = evaluateWorldPublishReadiness(snapshot);
  assert.ok(result.checks.some((item) => item.id === "segments.ch1.beat_plan_missing"));
  assert.ok(!result.checks.some((item) => item.id === "segments.ch1.beat_plan_incomplete"));
});
