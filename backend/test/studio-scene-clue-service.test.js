import assert from "node:assert/strict";
import test from "node:test";
import { normalizeStudioSceneClueError } from "../src/studio-scene-clue-service.js";

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
