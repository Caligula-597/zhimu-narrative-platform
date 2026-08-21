import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCluePathBinding,
  normalizeStudioSceneClueError
} from "../src/studio-scene-clue-service.js";

test("database contention becomes typed studio write errors", () => {
  for (const code of ["40P01", "55P03"]) {
    const busy = normalizeStudioSceneClueError({ code });
    assert.equal(busy.statusCode, 409);
    assert.equal(busy.code, "STUDIO_WRITE_BUSY");
  }
  const timeout = normalizeStudioSceneClueError({ code: "57014" });
  assert.equal(timeout.statusCode, 503);
  assert.equal(timeout.code, "STUDIO_WRITE_TIMEOUT");
});

test("unrelated studio errors retain their original identity", () => {
  const original = Object.assign(new Error("unchanged"), { code: "SCENE_NOT_FOUND" });
  assert.equal(normalizeStudioSceneClueError(original), original);
});

test("bulk clue path binding requires one explicit discovery decision", () => {
  assert.deepEqual(normalizeCluePathBinding({
    clueIds: ["clue-1", "clue-1", "clue-2"],
    segmentKey: "ch2",
    allowUnbound: false
  }), {
    clueIds: ["clue-1", "clue-2"],
    segmentKey: "ch2",
    allowUnbound: false
  });
  assert.throws(
    () => normalizeCluePathBinding({ clueIds: ["clue-1"], allowUnbound: false }),
    (error) => error.code === "CLUE_PATH_INVALID"
  );
  assert.throws(
    () => normalizeCluePathBinding({
      clueIds: ["clue-1"],
      segmentKey: "ch2",
      allowUnbound: true
    }),
    (error) => error.code === "CLUE_PATH_INVALID"
  );
});
