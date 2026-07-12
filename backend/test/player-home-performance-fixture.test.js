import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

test("performance fixture is scoped, reports users and supports cleanup", async () => {
  const source = await fs.readFile(new URL("../scripts/player-home-performance-fixture.mjs", import.meta.url), "utf8");
  assert.match(source, /FIXTURE\.worldId/);
  assert.match(source, /FIXTURE\.roomId/);
  assert.match(source, /--cleanup/);
  assert.match(source, /perf-player-/);
  assert.match(source, /PLAYER_HOME_USER_IDS/);
});
