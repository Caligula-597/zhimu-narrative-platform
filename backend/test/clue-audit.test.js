import assert from "node:assert/strict";
import test from "node:test";
import { evaluateClueAudit } from "../src/clue-audit.js";

test("evaluateClueAudit reports missing text and unlinked clues", () => {
  const snapshot = {
    clues: [
      { id: "c1", name: "线索 A", public_text: "正文", metadata: { importance: "key" } },
      { id: "c2", name: "线索 B", public_text: "", metadata: {} },
      { id: "c3", name: "线索 B", public_text: "重复名", metadata: {} }
    ],
    investigationPoints: [{ id: "p1", clue_id: "c1", scene_id: "s1" }],
    edges: [{ from_type: "clue", from_id: "c1", to_type: "clue", to_id: "c2" }]
  };

  const report = evaluateClueAudit(snapshot);
  assert.equal(report.total, 3);
  assert.ok(report.score > 0 && report.score < 100);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((item) => item.id === "clues.missing_public_text"));
  assert.ok(report.issues.some((item) => item.id === "clues.unlinked_investigation"));
  assert.ok(report.issues.some((item) => item.id === "clues.duplicate_names"));
  assert.equal(report.summary.keyed, 1);
});

test("evaluateClueAudit passes clean library", () => {
  const snapshot = {
    clues: [{ id: "c1", name: "关键线索", public_text: "玩家可见", metadata: { importance: "key" } }],
    investigationPoints: [{ id: "p1", clue_id: "c1", scene_id: "s1" }],
    edges: [{ from_type: "scene", from_id: "s1", to_type: "clue", to_id: "c1" }]
  };
  const report = evaluateClueAudit(snapshot);
  assert.equal(report.ok, true);
  assert.equal(report.issues.length, 0);
  assert.equal(report.score, 100);
});
