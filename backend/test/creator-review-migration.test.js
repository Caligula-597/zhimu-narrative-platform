import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../migrations/091_creator_review_workflow.sql", import.meta.url);

test("creator review migration preserves audit history and world-local reply trees", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'reviewer'/i);
  assert.match(sql, /created_by_user_id uuid REFERENCES users\(id\) ON DELETE SET NULL/i);
  assert.doesNotMatch(sql, /created_by_user_id[^,\n]*ON DELETE CASCADE/i);
  assert.match(sql, /UNIQUE \(world_id, id\)/i);
  assert.match(
    sql,
    /FOREIGN KEY \(world_id, parent_id\)\s+REFERENCES creator_review_threads\(world_id, id\) ON DELETE CASCADE/i
  );
});
