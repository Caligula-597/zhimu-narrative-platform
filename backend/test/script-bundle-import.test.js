import assert from "node:assert/strict";
import test from "node:test";
import AdmZip from "adm-zip";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureWorldId } from "./helpers/fixture-ids.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

function buildSampleZip() {
  const zip = new AdmZip();
  zip.addFile("172-水上之谜 (7人开放)/人物剧本/卞夫人.txt", Buffer.from("第一幕\n角色正文", "utf8"));
  zip.addFile("172-水上之谜 (7人开放)/调查线索/长秋宫1.jpg", Buffer.from("fake-jpeg", "utf8"));
  zip.addFile("172-水上之谜 (7人开放)/组织者手册.txt", Buffer.from("主持流程", "utf8"));
  return zip.toBuffer();
}

async function createIsolatedWorld(label) {
  const result = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, settings)
     VALUES ($1, $2, $3, '{"testIsolation":"script-bundle"}'::jsonb)
     RETURNING id`,
    [hostUserId, `bundle-test-${label}-${Date.now()}`, "isolated script-bundle test world"]
  );
  const worldId = result.rows[0].id;
  await query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`, [worldId, hostUserId]);
  return worldId;
}

test("POST script-bundle analyze returns inventory", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;
  const buffer = buildSampleZip();
  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/script-bundle/analyze`,
    headers: { "x-user-id": hostUserId },
    payload: {
      filename: "水上之谜.zip",
      contentBase64: buffer.toString("base64")
    }
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.suggestedWorldName, "水上之谜");
  assert.equal(body.suggestedPlayerCount, 7);
  assert.ok(body.inventory.length >= 3);
  assert.ok(body.summary.role_script >= 1);
  assert.ok(body.summary.clue >= 1);
});

test("POST script-bundle import creates roles clues manuscript and knowledge chunks", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  const worldId = await createIsolatedWorld("import");
  context.after(async () => {
    await app.close();
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const buffer = buildSampleZip();
  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/script-bundle/import`,
    headers: { "x-user-id": hostUserId },
    payload: {
      filename: "bundle-import-test.zip",
      contentBase64: buffer.toString("base64"),
      createMissingRoles: true,
      publicationStatus: "draft"
    }
  });
  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.ok, true);
  assert.ok(body.summary.imported >= 2);

  const role = await query(`SELECT id, name FROM role_slots WHERE world_id = $1 AND name = '卞夫人'`, [worldId]);
  assert.ok(role.rowCount, "role 卞夫人 should be created");
  const sections = await query(`SELECT id FROM script_sections WHERE role_slot_id = $1`, [role.rows[0].id]);
  assert.ok(sections.rowCount >= 1);

  const chunks = await query(
    `SELECT source_type, role_slot_id, body FROM knowledge_chunks WHERE world_id = $1 ORDER BY source_type, chunk_index`,
    [worldId]
  );
  assert.ok(chunks.rows.some((row) => row.source_type === "script_section" && row.role_slot_id === role.rows[0].id && row.body.includes("角色正文")));
  assert.ok(chunks.rows.some((row) => row.source_type === "story_manuscript" && row.body.includes("主持流程")));

  const clues = await query(
    `SELECT id FROM clues WHERE world_id = $1 AND metadata->>'importKey' LIKE 'script-bundle:%长秋宫1.jpg%'`,
    [worldId]
  );
  assert.ok(clues.rowCount >= 1);

  const manuscript = await query(`SELECT body FROM story_manuscripts WHERE world_id = $1`, [worldId]);
  assert.ok(manuscript.rowCount);
  assert.match(manuscript.rows[0].body, /主持流程/);
});
