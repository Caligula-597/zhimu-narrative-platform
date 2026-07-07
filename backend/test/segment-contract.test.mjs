import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSegmentOperations,
  resolveChapterSegmentKey,
  resolveSectionSegmentKey,
  segmentRunbookFromOperations
} from "../../shared/segment-contract.js";
import * as backendContract from "../src/segment-contract.js";
import { resolveCurrentActKey } from "../src/player-tasks.js";

test("segment contract resolves stable keys from proposal metadata", () => {
  assert.equal(resolveChapterSegmentKey({ sequence: 2, metadata: { proposalKey: "ch-alpha" } }), "ch-alpha");
  assert.equal(resolveChapterSegmentKey({ sequence: 2, metadata: { matrixActKey: "matrix-2" } }), "matrix-2");
  assert.equal(resolveSectionSegmentKey({ sequence: 3, metadata: { chapterKey: "ch3" } }), "ch3");
  assert.equal(resolveSectionSegmentKey({ sequence: 4, metadata: {} }), "ch4");
});

test("segment operations normalize to the runtime runbook shape", () => {
  const operations = normalizeSegmentOperations({
    title: "Act 1",
    flow: "Open",
    hostTruth: "Truth",
    clueGrants: [{ clue_id: "knife", timing: "after intro" }],
    fallbacks: ["nudge"],
    playerTips: "look closer"
  });
  assert.equal(operations.schemaVersion, 1);
  assert.deepEqual(operations.clueGrants[0], { clueId: "knife", when: "after intro", roleKey: "" });
  assert.deepEqual(operations.playerTips, ["look closer"]);

  const runbook = segmentRunbookFromOperations({ segmentKey: "ch1", title: "Chapter", sequence: 1, operations });
  assert.equal(runbook.actKey, "ch1");
  assert.equal(runbook.title, "Act 1");
});

test("backend and shared segment contracts stay aligned", () => {
  const segment = {
    segmentKey: "ch1",
    title: "Chapter",
    sequence: 1,
    operations: {
      title: "Act 1",
      flow: "Open",
      hostTruth: "Truth",
      clueGrants: [{ clue_id: "knife", timing: "after intro" }],
      fallbacks: ["nudge"],
      playerTips: "look closer"
    }
  };
  assert.deepEqual(backendContract.normalizeSegmentOperations(segment.operations), normalizeSegmentOperations(segment.operations));
  assert.deepEqual(backendContract.segmentRunbookFromOperations(segment), segmentRunbookFromOperations(segment));
});

test("player current act prefers matching world segment over section fallback", () => {
  const sections = [
    { id: "s1", sequence: 1, chapter_id: "chapter-a", completed: true, metadata: { chapterKey: "legacy-1" } },
    { id: "s2", sequence: 2, chapter_id: "chapter-b", completed: false, metadata: { chapterKey: "legacy-2" } }
  ];
  const segments = [
    { segment_key: "ch1", chapter_id: "chapter-a" },
    { segment_key: "ch2", chapter_id: "chapter-b" }
  ];
  assert.equal(resolveCurrentActKey(sections, segments), "ch2");
});
