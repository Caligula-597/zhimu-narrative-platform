import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool, transaction } from "../src/db.js";
import { FIXTURE } from "../scripts/fixture-constants.mjs";
import {
  importDeepseekPipelinePackage,
  materializePipelineReadingUnlockRules
} from "../src/routes/world-helpers.js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("materializePipelineReadingUnlockRules creates per-role act unlock rules", async (t) => {
  const fixtureCandidates = [
    join(root, "backend/test/fixtures/matrix-pipeline-minimal.json"),
    join(root, "examples/pending-review/停雪公馆/import-package.json")
  ];
  const fixturePath = fixtureCandidates.find((p) => existsSync(p));
  assert.ok(fixturePath, "matrix pipeline fixture missing");
  const pipeline = JSON.parse(readFileSync(fixturePath, "utf8"));
  const worldId = randomUUID();
  await pool.query(
    `INSERT INTO worlds (id, owner_user_id, name, summary, status) VALUES ($1,$2,'规则测试','', 'testing')`,
    [worldId, FIXTURE.hostUserId]
  );
  await pool.query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1,$2,'owner')`, [
    worldId,
    FIXTURE.hostUserId
  ]);
  t.after(async () => {
    await pool.query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const imported = await importDeepseekPipelinePackage(worldId, pipeline);
  assert.ok(imported.unlockRulesCreated >= 1);
  assert.ok(imported.segmentsSeeded >= 1, `segmentsSeeded=${imported.segmentsSeeded}`);

  const dup = await transaction((client) =>
    materializePipelineReadingUnlockRules(client, worldId, { matrixMode: "honkaku" })
  );
  assert.equal(dup.rulesCreated, 0);

  const rules = await pool.query(
    `SELECT name, mode FROM automation_rules WHERE world_id = $1 AND room_id IS NULL ORDER BY priority`,
    [worldId]
  );
  assert.ok(rules.rowCount >= 1);
  assert.ok(rules.rows.every((row) => row.mode === "host_confirm"));
});
