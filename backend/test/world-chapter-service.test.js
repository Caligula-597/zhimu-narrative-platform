import assert from "node:assert/strict";
import test from "node:test";
import { compactChapterSequences } from "../src/world-chapter-service.js";

test("compactChapterSequences uses a constant two-query compaction", async () => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      return calls.length === 1 ? { rowCount: 120, rows: [] } : { rowCount: 120, rows: [] };
    }
  };

  const count = await compactChapterSequences(client, "world-1");

  assert.equal(count, 120);
  assert.equal(calls.length, 2);
  assert.match(calls[0].text, /SET sequence = c\.sequence \+ bounds\.offset/);
  assert.match(calls[1].text, /ROW_NUMBER\(\) OVER/);
  assert.deepEqual(calls.map((call) => call.params), [["world-1"], ["world-1"]]);
});

test("compactChapterSequences skips ranking when the world has no chapters", async () => {
  let calls = 0;
  const client = {
    async query() {
      calls += 1;
      return { rowCount: 0, rows: [] };
    }
  };

  assert.equal(await compactChapterSequences(client, "world-empty"), 0);
  assert.equal(calls, 1);
});
