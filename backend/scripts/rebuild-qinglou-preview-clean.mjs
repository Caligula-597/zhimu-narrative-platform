/**
 * Wipe messy qinglou preview worlds and rebuild from clue cards + host handbook.
 * Exploration map locations become scenes only — never stub clues.
 *
 * Usage:
 *   DATABASE_URL=... node backend/scripts/rebuild-qinglou-preview-clean.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { FIXTURE } from "./fixture-constants.mjs";
import { pool } from "../src/db.js";
import { importStructuredCreatorDocumentWithClient } from "../src/creator-document-structure-service.js";
import { extractQinglouClueCardCatalog } from "../src/document-clue-catalog.js";

const require = createRequire(import.meta.url);
const mammoth = require("../node_modules/mammoth");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scriptPath = path.join(root, "案例", "561青楼", "剧本.docx");
const frontPath = path.join(root, "案例", "561青楼", "青楼线索卡正.docx");

async function main() {
  if (!fs.existsSync(scriptPath)) {
    console.error("missing", scriptPath);
    process.exitCode = 1;
    return;
  }

  const previewOwnerId = process.env.PREVIEW_OWNER_ID || "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const hostId = FIXTURE.hostUserId;
  const owner = await pool.query(
    `SELECT id FROM users WHERE id = $1 OR id = $2 ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END LIMIT 1`,
    [previewOwnerId, hostId]
  );
  const ownerUserId = owner.rows[0]?.id || hostId;

  const old = await pool.query(
    `SELECT id, name FROM worlds
     WHERE name LIKE '%青楼%'
        OR coalesce(settings->>'previewSource','') LIKE 'docx-structure%'`
  );
  for (const row of old.rows) {
    await pool.query(`DELETE FROM worlds WHERE id = $1`, [row.id]);
    console.log("deleted world", row.id, row.name);
  }

  const scriptText = (await mammoth.extractRawText({ path: scriptPath })).value || "";
  const frontText = fs.existsSync(frontPath)
    ? (await mammoth.extractRawText({ path: frontPath })).value || ""
    : "";
  console.log("card catalog size", extractQinglouClueCardCatalog(scriptText, frontText).length);

  const worldId = randomUUID();
  await pool.query(
    `INSERT INTO worlds (id, owner_user_id, name, summary, status, catalog_public, catalog_review_status, settings)
     VALUES ($1, $2, $3, $4, 'draft', false, 'none', $5::jsonb)`,
    [
      worldId,
      ownerUserId,
      "青楼（本地预览·私有）",
      "仅从线索卡目录 + 主持人手册导入。搜证地图地点只作场景，不作为线索正文。未上架公共库。",
      JSON.stringify({
        creationType: "murder_mystery",
        narrativeProfile: "murder_mystery",
        previewSource: "docx-structure-v3-cards-handbook",
        catalogPublic: false,
        sourcePolicy: "clue_cards_and_host_handbook"
      })
    ]
  );
  await pool.query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
    [worldId, ownerUserId]
  );
  if (ownerUserId !== hostId) {
    await pool.query(
      `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
      [worldId, hostId]
    );
  }

  const client = await pool.connect();
  let imported;
  try {
    await client.query("BEGIN");
    imported = await importStructuredCreatorDocumentWithClient(client, {
      worldId,
      document: { filename: "剧本.docx", text: scriptText },
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

  const counts = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM scenes WHERE world_id = $1) AS scenes,
       (SELECT count(*)::int FROM clues WHERE world_id = $1) AS clues,
       (SELECT count(*)::int FROM investigation_points WHERE world_id = $1) AS points,
       (SELECT count(*)::int FROM clues WHERE world_id = $1 AND metadata->>'sourceKind' = 'clue_card_catalog') AS card_clues,
       (SELECT count(*)::int FROM clues WHERE world_id = $1 AND name = ANY($2::text[])) AS map_named_clues`,
    [worldId, ["城北", "城西", "街市", "府南河", "城南"]]
  );

  const sample = await pool.query(
    `SELECT name, left(host_text, 40) AS preview, metadata->>'cardKind' AS card_kind, metadata->>'sourceKind' AS source_kind
     FROM clues WHERE world_id = $1
     ORDER BY coalesce(metadata->>'cardKind','zz'), name
     LIMIT 25`,
    [worldId]
  );

  console.log(
    JSON.stringify(
      {
        worldId,
        ownerUserId,
        imported,
        counts: counts.rows[0],
        sample: sample.rows,
        login: { email: "preview@zhimu.local", password: "preview123" }
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
