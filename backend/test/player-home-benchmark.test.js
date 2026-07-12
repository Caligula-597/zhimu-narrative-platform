import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";

test("player-home benchmark defines percentile gates and failure semantics", async () => {
  const source = await fs.readFile(new URL("../scripts/benchmark-player-home.mjs", import.meta.url), "utf8");
  assert.match(source, /p95-ms/);
  assert.match(source, /p99-ms/);
  assert.match(source, /successful\.length === requests/);
  assert.match(source, /process\.exitCode = 1/);
});
