import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

test("player-home route service composes domains without owning SQL", async () => {
  const source = await fs.readFile(new URL("../src/routes/player-home-service.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\b(?:SELECT|INSERT|UPDATE|DELETE)\b/i);
  assert.doesNotMatch(source, /from\s+["']\.\.\/db\.js["']/);
  assert.match(source, /player-home-content-repository/);
  assert.match(source, /player-home-social-repository/);
  assert.match(source, /player-home-session-repository/);
  assert.match(source, /player-home-progress-service/);
  assert.match(source, /loadPlayerHomeCore/);
  assert.match(source, /loadAuthorizedPlayerHomeCore/);
  assert.match(source, /loadPlayerHomeSupplemental/);
});

test("stable Player home cache is revision keyed and bounded", async () => {
  const source = await fs.readFile(new URL("../src/repositories/player-home-content-repository.js", import.meta.url), "utf8");
  assert.match(source, /worldId.*roleSlotId.*contentRevision/);
  assert.match(source, /PLAYER_HOME_STABLE_CACHE_MAX/);
  assert.match(source, /stableContentCache\.delete/);
});
