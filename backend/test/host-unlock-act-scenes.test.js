import assert from "node:assert/strict";
import test from "node:test";
import { sceneMatchesActUnlock } from "../../shared/host-act-scene-match.js";

const chapters = [
  { id: "ch-1", title: "第一幕", sequence: 1, metadata: { matrixActKey: "act1" } },
  { id: "ch-2", title: "第二幕", sequence: 2, metadata: { matrixActKey: "act2" } }
];

test("scenes match act by chapter membership or metadata segment key", () => {
  assert.equal(
    sceneMatchesActUnlock({ id: "s1", chapter_id: "ch-2", metadata: {} }, chapters, { actKey: "act2" }),
    true
  );
  assert.equal(
    sceneMatchesActUnlock({ id: "s2", metadata: { segmentKey: "act2" } }, chapters, { actKey: "act2" }),
    true
  );
  assert.equal(
    sceneMatchesActUnlock({ id: "s3", chapter_id: "ch-1", metadata: {} }, chapters, { actKey: "act2" }),
    false
  );
});
