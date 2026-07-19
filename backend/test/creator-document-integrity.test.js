import assert from "node:assert/strict";
import test from "node:test";
import { createCanvas } from "@napi-rs/canvas";
import { createApp } from "../src/app.js";
import { cleanupStoredObjects, uploadWorldAssetFromBuffer } from "../src/asset-upload-helpers.js";
import { pool, query } from "../src/db.js";
import {
  findImportedDocumentSection,
  lockDocumentRole
} from "../src/repositories/creator-document-repository.js";
import { getObjectStorage } from "../src/storage/index.js";
import { fixtureWorldId, hostUserId } from "./helpers/fixture-ids.js";

async function fixtureRoleId() {
  const result = await query(
    `SELECT id FROM role_slots WHERE world_id = $1 ORDER BY sequence LIMIT 1`,
    [fixtureWorldId]
  );
  assert.ok(result.rowCount, "role fixture required");
  return result.rows[0].id;
}

function parsedImportPayload(roleSlotId, filename, sectionPrefix) {
  return {
    target: "role_script",
    roleSlotId,
    document: {
      filename,
      text: `${sectionPrefix} 总稿`,
      sections: [1, 2, 3].map((index) => ({
        title: ` ${sectionPrefix}-${index} `,
        body: ` ${sectionPrefix} 正文 ${index} `
      }))
    }
  };
}

function uniquePngBase64() {
  const canvas = createCanvas(2, 2);
  const context = canvas.getContext("2d");
  context.fillStyle = `#${Date.now().toString(16).slice(-6)}`;
  context.fillRect(0, 0, 2, 2);
  return canvas.toBuffer("image/png").toString("base64");
}

test("concurrent parsed-document imports serialize per role and batch-create sections", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleSlotId = await fixtureRoleId();
  const marker = `document-batch-${Date.now()}`;
  const filenames = [`${marker}-a.md`, `${marker}-b.md`];
  context.after(() => query(
    `DELETE FROM script_sections
     WHERE role_slot_id = $1 AND metadata->>'filename' = ANY($2::text[])`,
    [roleSlotId, filenames]
  ));
  const scriptsBefore = await query(
    `SELECT COUNT(*)::int AS value FROM character_scripts WHERE role_slot_id = $1`,
    [roleSlotId]
  );

  const responses = await Promise.all(filenames.map((filename, index) => app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/documents/import`,
    headers: { "x-user-id": hostUserId },
    payload: parsedImportPayload(roleSlotId, filename, `${marker}-${index + 1}`)
  })));
  for (const response of responses) {
    assert.equal(response.statusCode, 201, response.body);
    assert.equal(response.json().sections, 3);
  }

  const created = await query(
    `SELECT sequence
     FROM script_sections
     WHERE role_slot_id = $1 AND metadata->>'filename' = ANY($2::text[])
     ORDER BY sequence`,
    [roleSlotId, filenames]
  );
  assert.equal(created.rowCount, 6);
  assert.equal(new Set(created.rows.map((row) => row.sequence)).size, 6);
  const scriptsAfter = await query(
    `SELECT COUNT(*)::int AS value FROM character_scripts WHERE role_slot_id = $1`,
    [roleSlotId]
  );
  assert.equal(scriptsAfter.rows[0].value, scriptsBefore.rows[0].value);
});

test("parsed-document import rejects foreign roles and oversized section arrays without revision drift", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const foreignWorld = await query(
    `INSERT INTO worlds (owner_user_id, name) VALUES ($1, $2) RETURNING id`,
    [hostUserId, `document-foreign-${Date.now()}`]
  );
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [foreignWorld.rows[0].id]));
  const foreignRole = await query(
    `INSERT INTO role_slots (world_id, name, sequence) VALUES ($1, 'foreign-role', 1) RETURNING id`,
    [foreignWorld.rows[0].id]
  );
  const revisionBefore = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [fixtureWorldId]);

  const foreign = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/documents/import`,
    headers: { "x-user-id": hostUserId },
    payload: parsedImportPayload(foreignRole.rows[0].id, "foreign.md", "foreign")
  });
  assert.equal(foreign.statusCode, 400, foreign.body);
  assert.equal(foreign.json().code, "ROLE_SLOT_IMPORT_REQUIRED");

  const localRoleId = await fixtureRoleId();
  const oversizedPayload = parsedImportPayload(localRoleId, "too-many.md", "too-many");
  oversizedPayload.document.sections = Array.from({ length: 81 }, (_, index) => ({
    title: `section-${index}`,
    body: "body"
  }));
  const oversized = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/documents/import`,
    headers: { "x-user-id": hostUserId },
    payload: oversizedPayload
  });
  assert.equal(oversized.statusCode, 400, oversized.body);
  assert.equal(oversized.json().code, "VALIDATION_ERROR");

  const revisionAfter = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [fixtureWorldId]);
  assert.equal(revisionAfter.rows[0].content_revision, revisionBefore.rows[0].content_revision);
});

test("image-page imports canonicalize MIME and duplicate imports do not bump world revision", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleSlotId = await fixtureRoleId();
  const contentBase64 = uniquePngBase64();
  const filename = `canonical-image-${Date.now()}.png`;
  const payload = {
    filename,
    contentType: "text/html",
    contentBase64,
    roleSlotId,
    title: "Canonical image"
  };
  const first = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/documents/import-pages`,
    headers: { "x-user-id": hostUserId },
    payload
  });
  assert.equal(first.statusCode, 201, first.body);
  assert.equal(first.json().skipped, false);
  const section = first.json().sections[0];
  const assetId = section.metadata.pageAssetIds[0];
  context.after(() => query(`DELETE FROM script_sections WHERE id = $1`, [section.id]));
  context.after(() => query(`DELETE FROM asset_files WHERE id = $1`, [assetId]));
  const asset = await query(`SELECT content_type, object_key FROM asset_files WHERE id = $1`, [assetId]);
  assert.equal(asset.rows[0].content_type, "image/png");
  context.after(() => cleanupStoredObjects([asset.rows[0].object_key]));

  const duplicate = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/documents/import-pages`,
    headers: { "x-user-id": hostUserId },
    payload
  });
  assert.equal(duplicate.statusCode, 201, duplicate.body);
  assert.equal(duplicate.json().skipped, true);
  assert.equal(duplicate.json().content_revision, first.json().content_revision);

  const invalidRevisionBefore = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [fixtureWorldId]);
  const spoofed = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/documents/import-pages`,
    headers: { "x-user-id": hostUserId },
    payload: { ...payload, filename: "spoofed.png", contentBase64: Buffer.from("not a png").toString("base64") }
  });
  assert.equal(spoofed.statusCode, 415, spoofed.body);
  assert.equal(spoofed.json().code, "DOCUMENT_TYPE_UNSUPPORTED");
  const invalidRevisionAfter = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [fixtureWorldId]);
  assert.equal(invalidRevisionAfter.rows[0].content_revision, invalidRevisionBefore.rows[0].content_revision);
});

test("document role locks serialize imports and import indexes are installed", async (context) => {
  const roleSlotId = await fixtureRoleId();
  const locker = await pool.connect();
  const contender = await pool.connect();
  try {
    await locker.query("BEGIN");
    await lockDocumentRole(locker, { worldId: fixtureWorldId, roleSlotId });
    await contender.query(`SET lock_timeout = '100ms'`);
    await assert.rejects(
      lockDocumentRole(contender, { worldId: fixtureWorldId, roleSlotId }),
      (error) => error.code === "55P03"
    );
  } finally {
    await locker.query("ROLLBACK").catch(() => {});
    await contender.query("RESET lock_timeout").catch(() => {});
    locker.release();
    contender.release();
  }

  const indexes = await query(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = ANY($1::text[])`,
    [["idx_script_sections_role_import_key", "idx_character_scripts_role_created"]]
  );
  assert.equal(indexes.rowCount, 2);
  assert.ok(indexes.rows.some((row) => /role_slot_id.*importKey/.test(row.indexdef)));
  assert.ok(indexes.rows.some((row) => /\(role_slot_id, created_at\)/.test(row.indexdef)));

  const importKey = `page-child-dedupe-${Date.now()}`;
  const pageChild = await query(
    `WITH target AS (
       SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1
     ), sequence_base AS (
       SELECT COALESCE(MAX(section.sequence), 0)::int AS value
       FROM script_sections section
       JOIN target ON target.id = section.character_script_id
     )
     INSERT INTO script_sections
       (character_script_id, role_slot_id, title, body, sequence, metadata)
     SELECT target.id, $1, 'page child dedupe', 'page', sequence_base.value + 1,
            jsonb_build_object('importKey', $2 || ':page:1')
     FROM target CROSS JOIN sequence_base
     RETURNING id`,
    [roleSlotId, importKey]
  );
  context.after(() => query(`DELETE FROM script_sections WHERE id = $1`, [pageChild.rows[0].id]));
  const duplicate = await findImportedDocumentSection(pool, {
    roleSlotId,
    importKeys: [importKey],
    includePageChildren: true
  });
  assert.equal(duplicate.id, pageChild.rows[0].id);
});

test("server-side asset upload removes the stored object when database registration fails", async () => {
  let objectKey;
  const client = {
    async query(_sql, parameters) {
      objectKey = parameters[6];
      throw new Error("forced asset row failure");
    }
  };
  await assert.rejects(
    uploadWorldAssetFromBuffer(client, {
      actorId: hostUserId,
      worldId: fixtureWorldId,
      filename: "rollback.png",
      buffer: Buffer.from(uniquePngBase64(), "base64"),
      contentType: "image/png"
    }),
    /forced asset row failure/
  );
  assert.ok(objectKey);
  await assert.rejects(
    getObjectStorage().statObject({ key: objectKey }),
    (error) => error?.name === "NotFound" || /not found/i.test(String(error?.message))
  );
});
