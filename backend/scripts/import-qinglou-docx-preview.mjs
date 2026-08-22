/**
 * Rebuild private qinglou preview world via structured document import
 * (scene↔clue links, triggers, handbook, endings, mini-games).
 *
 * Usage:
 *   DATABASE_URL=... node backend/scripts/import-qinglou-docx-preview.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { FIXTURE } from "./fixture-constants.mjs";
import { pool } from "../src/db.js";
import { importStructuredCreatorDocumentWithClient } from "../src/creator-document-structure-service.js";

const require = createRequire(import.meta.url);
const mammoth = require("../node_modules/mammoth");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const docxPath = path.join(root, "案例", "561青楼", "剧本.docx");

async function main() {
  if (!fs.existsSync(docxPath)) {
    console.error("missing", docxPath);
    process.exitCode = 1;
    return;
  }

  const text = (await mammoth.extractRawText({ buffer: fs.readFileSync(docxPath) })).value;
  const ownerId = process.env.PREVIEW_OWNER_ID || "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const hostId = FIXTURE.hostUserId;

  // Prefer preview login user if present, else fixture host.
  const owner = await pool.query(`SELECT id FROM users WHERE id = $1 OR id = $2 ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END LIMIT 1`, [
    ownerId,
    hostId
  ]);
  const ownerUserId = owner.rows[0]?.id || hostId;

  const worldId = randomUUID();
  await pool.query(
    `INSERT INTO worlds (id, owner_user_id, name, summary, status, catalog_public, catalog_review_status, settings)
     VALUES ($1, $2, $3, $4, 'draft', false, 'none', $5::jsonb)`,
    [
      worldId,
      ownerUserId,
      "青楼（本地预览·私有）",
      "从 561青楼/剧本.docx 结构化导入：场景线索配对、触发条件、主持手册与三类小游戏。未上架公共库。",
      JSON.stringify({
        creationType: "murder_mystery",
        narrativeProfile: "murder_mystery",
        previewSource: "docx-structure-v2",
        catalogPublic: false
      })
    ]
  );
  await pool.query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')
     ON CONFLICT DO NOTHING`,
    [worldId, ownerUserId]
  );
  if (ownerUserId !== hostId) {
    await pool.query(
      `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')
       ON CONFLICT DO NOTHING`,
      [worldId, hostId]
    );
  }

  const client = await pool.connect();
  let imported;
  try {
    await client.query("BEGIN");
    imported = await importStructuredCreatorDocumentWithClient(client, {
      worldId,
      document: { filename: "剧本.docx", text },
      creationType: "murder_mystery",
      rightsConfirmed: true
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  // Soft-archive previous preview worlds with same name (keep history, hide from default list if status supports)
  await pool.query(
    `UPDATE worlds
     SET status = 'archived',
         settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('replacedByPreview', $1::text)
     WHERE name = '青楼（本地预览·私有）'
       AND id <> $2::uuid
       AND coalesce(settings->>'previewSource', '') LIKE 'docx-structure%'`,
    [worldId, worldId]
  );

  console.log(
    JSON.stringify(
      {
        worldId,
        ownerUserId,
        imported,
        catalogPublic: false,
        loginHint: { email: "preview@zhimu.local", password: "preview123" }
      },
      null,
      2
    )
  );
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
