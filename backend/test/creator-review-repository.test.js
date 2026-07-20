import assert from "node:assert/strict";
import test from "node:test";
import { listCreatorReviews } from "../src/repositories/creator-review-repository.js";

test("creator review pagination keeps roots with a bounded reply window", async () => {
  let captured;
  const client = {
    async query(sql, params) {
      captured = { sql, params };
      return { rows: [] };
    }
  };

  await listCreatorReviews({
    worldId: "world-1",
    status: "open",
    targetType: "clue",
    limit: 25,
    client
  });

  assert.match(captured.sql, /WITH roots AS MATERIALIZED/);
  assert.match(captured.sql, /root\.parent_id IS NULL/);
  assert.match(captured.sql, /JOIN LATERAL/);
  assert.match(captured.sql, /child\.parent_id = root\.id[\s\S]*LIMIT 50/);
  assert.match(captured.sql, /JOIN selected ON selected\.id = review\.id/);
  assert.deepEqual(captured.params, ["world-1", "open", "clue", 25]);
});
