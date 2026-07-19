import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import {
  fixtureRoomId,
  fixtureWorldId,
  hostUserId
} from "./helpers/fixture-ids.js";
import { queryFixtureRoleId } from "./helpers/fixture-helpers.js";

async function worldRevision(worldId = fixtureWorldId) {
  const result = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [worldId]);
  return Number(result.rows[0].content_revision);
}

async function createForeignWorld(context, prefix) {
  const result = await query(
    `INSERT INTO worlds (owner_user_id, name) VALUES ($1, $2) RETURNING id`,
    [hostUserId, `${prefix}-${Date.now()}`]
  );
  const worldId = result.rows[0].id;
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [worldId]));
  return worldId;
}

test("creator section sequence validation and concurrent writes fail safely", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleSlotId = await queryFixtureRoleId();
  const script = await query(
    `SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1`,
    [roleSlotId]
  );
  assert.ok(script.rowCount, "character script fixture required");
  const maxSequence = await query(
    `SELECT COALESCE(MAX(sequence), 0)::int AS value
     FROM script_sections WHERE character_script_id = $1`,
    [script.rows[0].id]
  );
  const sequence = maxSequence.rows[0].value + 1;
  assert.ok(sequence <= 9999, "fixture section sequence exhausted");
  const revisionBefore = await worldRevision();

  const invalid = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/roles/${roleSlotId}/sections`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "invalid zero", body: "body", sequence: 0 }
  });
  assert.equal(invalid.statusCode, 400, invalid.body);
  assert.equal(invalid.json().code, "VALIDATION_ERROR");
  assert.equal(await worldRevision(), revisionBefore);

  const marker = `section-race-${Date.now()}`;
  const create = (suffix) => app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/roles/${roleSlotId}/sections`,
    headers: { "x-user-id": hostUserId },
    payload: { title: `${marker}-${suffix}`, body: "body", sequence }
  });
  const responses = await Promise.all([create("a"), create("b")]);
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [201, 409]);
  const conflict = responses.find((response) => response.statusCode === 409);
  assert.equal(conflict.json().code, "SECTION_SEQUENCE_CONFLICT");
  const created = responses.find((response) => response.statusCode === 201).json();
  context.after(() => query(`DELETE FROM script_sections WHERE id = $1`, [created.id]));
});

test("creator section updates preserve omitted fields and reject foreign chapters", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleSlotId = await queryFixtureRoleId();
  const chapter = await query(
    `SELECT id FROM chapters WHERE world_id = $1 ORDER BY sequence LIMIT 1`,
    [fixtureWorldId]
  );
  assert.ok(chapter.rowCount, "chapter fixture required");
  const section = await query(
    `SELECT id, title, body, chapter_id, publication_status
     FROM script_sections WHERE role_slot_id = $1 ORDER BY sequence LIMIT 1`,
    [roleSlotId]
  );
  assert.ok(section.rowCount, "section fixture required");
  const sectionId = section.rows[0].id;

  const establish = await app.inject({
    method: "PUT",
    url: `/api/worlds/${fixtureWorldId}/roles/${roleSlotId}/sections/${sectionId}`,
    headers: { "x-user-id": hostUserId },
    payload: {
      title: section.rows[0].title,
      body: section.rows[0].body,
      chapterId: chapter.rows[0].id,
      publicationStatus: "published"
    }
  });
  assert.equal(establish.statusCode, 200, establish.body);
  context.after(() => query(
    `UPDATE script_sections
     SET title = $2, body = $3, chapter_id = $4, publication_status = $5
     WHERE id = $1`,
    [
      sectionId,
      section.rows[0].title,
      section.rows[0].body,
      section.rows[0].chapter_id,
      section.rows[0].publication_status
    ]
  ));

  const preserved = await app.inject({
    method: "PUT",
    url: `/api/worlds/${fixtureWorldId}/roles/${roleSlotId}/sections/${sectionId}`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "保留关联", body: "更新正文" }
  });
  assert.equal(preserved.statusCode, 200, preserved.body);
  assert.equal(preserved.json().chapter_id, chapter.rows[0].id);
  assert.equal(preserved.json().publication_status, "published");

  const foreignWorldId = await createForeignWorld(context, "section-foreign");
  const foreignChapter = await query(
    `INSERT INTO chapters (world_id, title, sequence) VALUES ($1, 'foreign', 1) RETURNING id`,
    [foreignWorldId]
  );
  const revisionBefore = await worldRevision();
  const rejected = await app.inject({
    method: "PUT",
    url: `/api/worlds/${fixtureWorldId}/roles/${roleSlotId}/sections/${sectionId}`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "越界", body: "越界", chapterId: foreignChapter.rows[0].id }
  });
  assert.equal(rejected.statusCode, 404, rejected.body);
  assert.equal(rejected.json().code, "CHAPTER_NOT_FOUND");
  assert.equal(await worldRevision(), revisionBefore);
});

test("studio item writes reject foreign assets and merge concurrent metadata", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const foreignWorldId = await createForeignWorld(context, "item-asset-foreign");
  const foreignAsset = await query(
    `INSERT INTO asset_files
       (owner_user_id, world_id, asset_kind, object_key, original_filename,
        content_type, byte_size, status)
     VALUES ($1, $2, 'image', $3, 'foreign.png', 'image/png', 1, 'active')
     RETURNING id`,
    [hostUserId, foreignWorldId, `test/foreign-item-${randomUUID()}`]
  );
  const revisionBefore = await worldRevision();
  const rejected = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/items`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "foreign asset item", assetId: foreignAsset.rows[0].id }
  });
  assert.equal(rejected.statusCode, 404, rejected.body);
  assert.equal(rejected.json().code, "ASSET_NOT_FOUND");
  assert.equal(await worldRevision(), revisionBefore);

  const created = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/items`,
    headers: { "x-user-id": hostUserId },
    payload: { name: `metadata-merge-${Date.now()}`, metadata: { base: true } }
  });
  assert.equal(created.statusCode, 201, created.body);
  const itemId = created.json().id;
  context.after(() => query(`DELETE FROM items WHERE id = $1`, [itemId]));
  const patch = (metadata) => app.inject({
    method: "PATCH",
    url: `/api/worlds/${fixtureWorldId}/items/${itemId}`,
    headers: { "x-user-id": hostUserId },
    payload: { metadata }
  });
  const patches = await Promise.all([patch({ alpha: true }), patch({ beta: true })]);
  assert.ok(patches.every((response) => response.statusCode === 200), patches.map((row) => row.body).join("\n"));
  const stored = await query(`SELECT metadata FROM items WHERE id = $1`, [itemId]);
  assert.deepEqual(stored.rows[0].metadata, { base: true, alpha: true, beta: true });
});

test("studio item deletion preserves referenced runtime inventory", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleSlotId = await queryFixtureRoleId();
  const item = await query(
    `INSERT INTO items (world_id, name) VALUES ($1, $2) RETURNING id`,
    [fixtureWorldId, `referenced-item-${Date.now()}`]
  );
  const itemId = item.rows[0].id;
  context.after(() => query(`DELETE FROM inventory WHERE item_id = $1`, [itemId]));
  context.after(() => query(`DELETE FROM items WHERE id = $1`, [itemId]));
  await query(
    `INSERT INTO inventory (room_id, role_slot_id, item_id, quantity)
     VALUES ($1, $2, $3, 1)`,
    [fixtureRoomId, roleSlotId, itemId]
  );
  const revisionBefore = await worldRevision();
  const response = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${fixtureWorldId}/items/${itemId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(response.statusCode, 409, response.body);
  assert.equal(response.json().code, "ITEM_REFERENCED");
  assert.equal(response.json().details.references.inventory, 1);
  assert.equal(await worldRevision(), revisionBefore);
  const inventory = await query(`SELECT quantity FROM inventory WHERE item_id = $1`, [itemId]);
  assert.equal(inventory.rows[0].quantity, 1);
});

test("content versions batch-restore content while create and delete keep revision stable", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const section = await query(
    `SELECT section.id, section.title, section.body
     FROM script_sections section
     JOIN role_slots role_slot ON role_slot.id = section.role_slot_id
     WHERE role_slot.world_id = $1
     ORDER BY section.created_at LIMIT 1`,
    [fixtureWorldId]
  );
  assert.ok(section.rowCount, "section fixture required");
  const revisionBefore = await worldRevision();
  const created = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/content-versions`,
    headers: { "x-user-id": hostUserId },
    payload: { label: `batch-restore-${Date.now()}` }
  });
  assert.equal(created.statusCode, 201, created.body);
  const versionId = created.json().id;
  context.after(() => query(`DELETE FROM content_versions WHERE id = $1`, [versionId]));
  assert.equal(created.json().content_revision, revisionBefore);

  await query(
    `UPDATE script_sections SET title = 'mutated title', body = 'mutated body' WHERE id = $1`,
    [section.rows[0].id]
  );
  const restored = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/content-versions/${versionId}/restore`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(restored.statusCode, 200, restored.body);
  assert.ok(restored.json().chaptersRestored >= 1);
  assert.ok(restored.json().sectionsRestored >= 1);
  const stored = await query(`SELECT title, body FROM script_sections WHERE id = $1`, [section.rows[0].id]);
  assert.equal(stored.rows[0].title, section.rows[0].title);
  assert.equal(stored.rows[0].body, section.rows[0].body);
  const restoreRevision = await worldRevision();
  assert.equal(restoreRevision, revisionBefore + 1);

  const deleted = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${fixtureWorldId}/content-versions/${versionId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(deleted.statusCode, 200, deleted.body);
  assert.equal(deleted.json().content_revision, restoreRevision);
});

test("corrupt content versions fail without content or revision drift", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const version = await query(
    `INSERT INTO content_versions (world_id, created_by_user_id, label, snapshot)
     VALUES ($1, $2, 'corrupt snapshot', $3::jsonb)
     RETURNING id`,
    [fixtureWorldId, hostUserId, JSON.stringify({ chapters: [], sections: [{ id: randomUUID(), title: "bad" }] })]
  );
  const versionId = version.rows[0].id;
  context.after(() => query(`DELETE FROM content_versions WHERE id = $1`, [versionId]));
  const revisionBefore = await worldRevision();
  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/content-versions/${versionId}/restore`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(response.statusCode, 422, response.body);
  assert.equal(response.json().code, "CONTENT_VERSION_INVALID");
  assert.equal(await worldRevision(), revisionBefore);
});

test("item reference indexes are installed", async () => {
  const indexes = await query(
    `SELECT indexname, indexdef FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
    [["idx_investigation_points_world_required_item", "idx_inventory_item_room"]]
  );
  assert.equal(indexes.rowCount, 2);
  assert.ok(indexes.rows.some((row) => /world_id, required_item_id/.test(row.indexdef)));
  assert.ok(indexes.rows.some((row) => /item_id, room_id/.test(row.indexdef)));
});
