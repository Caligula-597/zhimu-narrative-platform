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

test("creative constitution overrides generic evidence minimum and reports coverage", () => {
  const snapshot = completeSnapshot();
  snapshot.world = {
    id: "world-1",
    settings: {
      creativeConstitution: {
        theme: "错误时间顺序如何制造偏见",
        intendedEmotion: "从确信到愧疚",
        experiencePromise: "玩家在终局前三十分钟逐步发现时间顺序错误。",
        revealEmotion: "重新理解嫌疑人的选择",
        inviolablePrinciples: ["关键证据必须提前出现"],
        fairPuzzlePromises: ["案发时间必须可由游戏内物证推出"],
        pacingPrinciples: ["第二幕只加速旧信息碰撞"],
        voicePrinciples: ["角色本避免全知视角"],
        forbiddenTropes: ["失忆", "双胞胎"],
        supernaturalPolicy: "forbidden",
        supernaturalRules: "不能以超自然力量改变物证。",
        desiredDebates: "隐瞒真相是否等于说谎",
        avoidMisunderstandings: "不把沉默等同于有罪",
        roleHighlights: [
          { roleId: "role-a", promise: "决定是否公开停摆的钟。" },
          { roleId: "role-b", promise: "用车票重建时间线。" }
        ],
        fairness: {
          minimumEvidence: 3,
          requireIndependentPaths: true
        }
      }
    }
  };

  const report = evaluateStoryDiagnostics(snapshot, { standard: "emotional" });

  assert.equal(report.standard.defaultMinEvidence, 1);
  assert.equal(report.standard.minEvidence, 3);
  assert.equal(report.standard.constitutionOverride, true);
  assert.equal(report.fairness.claims[0].status, "weak");
  assert.equal(report.constitution.configured, true);
  assert.equal(report.constitution.score, 100);
  assert.equal(report.scores.intent, 100);
  assert.ok(!report.issues.some((issue) => issue.id === "intent.no_constitution"));
});
