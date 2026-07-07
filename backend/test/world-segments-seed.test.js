import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { pool, transaction } from "../src/db.js";
import { FIXTURE } from "../scripts/fixture-constants.mjs";
import { importDeepseekPipelinePackage } from "../src/routes/world-helpers.js";
import { syncWorldSegmentsFromChapters } from "../src/world-segments-seed.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pipeline = JSON.parse(readFileSync(join(root, "test/fixtures/matrix-pipeline-minimal.json"), "utf8"));

test("importDeepseekPipelinePackage seeds world_segments from Matrix", async (t) => {
  const worldId = randomUUID();
  await pool.query(
    `INSERT INTO worlds (id, owner_user_id, name, summary, status) VALUES ($1,$2,'Segment测试','', 'testing')`,
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
  assert.equal(imported.segmentsSeeded, 2);

  const segments = await pool.query(
    `SELECT segment_key, title, operations->>'flow' AS flow, operations->'playerTasks' AS player_tasks
     FROM world_segments WHERE world_id = $1 ORDER BY sequence`,
    [worldId]
  );
  assert.equal(segments.rowCount, 2);
  assert.equal(segments.rows[0].segment_key, "ch1");
  assert.match(segments.rows[0].flow || "", /宣读背景/);
  assert.ok((segments.rows[0].player_tasks || []).length >= 1);

  const refs = await pool.query(
    `SELECT ref_type FROM world_segment_refs wsr
     JOIN world_segments ws ON ws.id = wsr.segment_id
     WHERE ws.world_id = $1`,
    [worldId]
  );
  assert.ok(refs.rowCount >= 2);
  assert.ok(refs.rows.some((r) => r.ref_type === "chapter"));
});

test("syncWorldSegmentsFromChapters upserts from existing chapters", async (t) => {
  const worldId = randomUUID();
  await pool.query(
    `INSERT INTO worlds (id, owner_user_id, name, summary, status) VALUES ($1,$2,'Chapter Sync','', 'testing')`,
    [worldId, FIXTURE.hostUserId]
  );
  t.after(async () => {
    await pool.query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  await pool.query(
    `INSERT INTO chapters (world_id, title, sequence, metadata) VALUES ($1,'幕一',1,'{"proposalKey":"ch1"}'::jsonb)`,
    [worldId]
  );

  const count = await transaction((client) => syncWorldSegmentsFromChapters(client, worldId));
  assert.equal(count, 1);

  const row = await pool.query(`SELECT segment_key, title FROM world_segments WHERE world_id = $1`, [worldId]);
  assert.equal(row.rowCount, 1);
  assert.equal(row.rows[0].segment_key, "ch1");
});
