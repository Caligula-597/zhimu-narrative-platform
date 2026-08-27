import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateStoryDiagnostics,
  STORY_DIAGNOSTIC_STANDARDS
} from "../src/story-diagnostics.js";

function completeSnapshot() {
  return {
    chapters: [{ id: "chapter-1", title: "第一幕", sequence: 1 }],
    roles: [
      { id: "role-a", name: "林远", sequence: 1 },
      { id: "role-b", name: "陈默", sequence: 2 }
    ],
    sections: [
      { id: "section-a", role_slot_id: "role-a", chapter_id: "chapter-1", title: "林远第一幕", sequence: 1 },
      { id: "section-b", role_slot_id: "role-b", chapter_id: "chapter-1", title: "陈默第一幕", sequence: 1 }
    ],
    scenes: [
      { id: "scene-1", chapter_id: "chapter-1", name: "案发现场" },
      { id: "scene-2", chapter_id: "chapter-1", name: "钟楼对质" }
    ],
    clues: [
      {
        id: "clue-a",
        name: "停摆的钟",
        visibility: "role",
        metadata: { importance: "key" }
      },
      {
        id: "clue-b",
        name: "烧焦的车票",
        visibility: "role",
        metadata: { importance: "truth_piece" }
      }
    ],
    investigationPoints: [
      { id: "point-a", scene_id: "scene-1", clue_id: "clue-a", name: "检查挂钟" },
      { id: "point-b", scene_id: "scene-1", clue_id: "clue-b", name: "翻找壁炉" },
      { id: "point-b2", scene_id: "scene-2", clue_id: "clue-b", name: "检查衣袋" }
    ],
    items: [],
    rules: [
      {
        id: "rule-1",
        name: "获得钟表线索后开放钟楼",
        enabled: true,
        conditions: { all: [{ type: "clue_owned", roleSlotId: "role-a", clueId: "clue-a" }] },
        actions: [{ type: "unlock_scene", sceneId: "scene-2" }]
      }
    ],
    edges: [
      {
        id: "edge-1",
        from_type: "scene",
        from_id: "scene-1",
        to_type: "scene",
        to_id: "scene-2",
        relation_type: "mainline",
        label: "证据推动对质"
      }
    ],
    segments: [
      { id: "segment-1", segment_key: "act-1", title: "调查", sequence: 1, operations: {} },
      { id: "segment-2", segment_key: "act-2", title: "对质", sequence: 2, operations: {} }
    ],
    segmentRefs: [
      { segment_id: "segment-1", ref_type: "clue", ref_id: "clue-a", role_slot_id: "role-a" },
      { segment_id: "segment-1", ref_type: "clue", ref_id: "clue-b", role_slot_id: "role-b" }
    ],
    truthClaims: [
      {
        id: "truth-1",
        title: "案发时间被伪造",
        confidence: "canon",
        reveal_stage: "终局",
        evidence: [
          { refType: "clue", refId: "clue-a" },
          { refType: "clue", refId: "clue-b" }
        ],
        contradictions: [],
        role_visibility: {}
      }
    ]
  };
}

test("story diagnostics keeps every issue traceable to structured objects", () => {
  const snapshot = completeSnapshot();
  snapshot.edges = [];
  snapshot.investigationPoints = snapshot.investigationPoints.filter((point) => point.clue_id !== "clue-a");
  snapshot.segmentRefs = snapshot.segmentRefs.filter((ref) => ref.ref_id !== "clue-a");

  const report = evaluateStoryDiagnostics(snapshot, { standard: "classic" });

  assert.equal(report.standard.id, "classic");
  assert.ok(report.issues.some((issue) => issue.id === "information.unreachable_clue.clue-a"));
  assert.ok(report.issues.some((issue) => issue.id === "information.single_point_clue.clue-b") === false);
  assert.ok(report.issues.every((issue) => Array.isArray(issue.refs)));
  assert.ok(report.causal.chains.some((chain) => chain.kind === "evidence"));
  assert.ok(report.scores.overall >= 0 && report.scores.overall <= 100);
});

test("classic fairness requires more evidence than emotional restore", () => {
  const snapshot = completeSnapshot();
  snapshot.truthClaims[0].evidence = [{ refType: "clue", refId: "clue-a" }];

  const classic = evaluateStoryDiagnostics(snapshot, { standard: "classic" });
  const emotional = evaluateStoryDiagnostics(snapshot, { standard: "emotional" });

  assert.equal(classic.fairness.claims[0].status, "weak");
  assert.equal(emotional.fairness.claims[0].status, "supported");
  assert.ok(classic.issues.some((issue) => issue.id === "fairness.weak_truth.truth-1"));
  assert.ok(!emotional.issues.some((issue) => issue.id === "fairness.weak_truth.truth-1"));
});

test("diagnostics identifies distributed evidence that requires communication", () => {
  const report = evaluateStoryDiagnostics(completeSnapshot(), { standard: "classic" });

  assert.equal(report.information.communicationNeeds.length, 1);
  assert.deepEqual(
    new Set(report.information.communicationNeeds[0].roles.map((role) => role.id)),
    new Set(["role-a", "role-b"])
  );
  assert.equal(report.fairness.supportedClaims, 1);
});

test("unknown standard falls back to classic without mutating profiles", () => {
  const before = STORY_DIAGNOSTIC_STANDARDS.classic.minEvidence;
  const report = evaluateStoryDiagnostics(completeSnapshot(), { standard: "unknown" });
  assert.equal(report.standard.id, "classic");
  assert.equal(STORY_DIAGNOSTIC_STANDARDS.classic.minEvidence, before);
});
