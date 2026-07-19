import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { pool, query } from "../src/db.js";
import {
  lockSceneChapterReference,
  lockStudioSceneClueEditor
} from "../src/repositories/studio-scene-clue-repository.js";
import { hostUserId } from "./helpers/fixture-ids.js";

async function createStudioWorld(label) {
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary)
     VALUES ($1, $2, '') RETURNING id`,
    [hostUserId, `${label}-${randomUUID()}`]
  );
  const worldId = world.rows[0].id;
  await query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [worldId, hostUserId]
  );
  return worldId;
}

test("scene and clue names are trimmed and whitespace-only creates are rejected", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await createStudioWorld("scene-clue-name");
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [worldId]));
  const headers = { "x-user-id": hostUserId };

  for (const resource of ["scenes", "clues"]) {
    const invalid = await app.inject({
      method: "POST",
      url: `/api/worlds/${worldId}/${resource}`,
      headers,
      payload: { name: "   " }
    });
    assert.equal(invalid.statusCode, 400, invalid.body);
    assert.equal(invalid.json().code, "NAME_EMPTY");

    const created = await app.inject({
      method: "POST",
      url: `/api/worlds/${worldId}/${resource}`,
      headers,
      payload: { name: "  Trimmed studio name  " }
    });
    assert.equal(created.statusCode, 201, created.body);
    assert.equal(created.json().name, "Trimmed studio name");
  }
});

test("scene patch rejects a foreign chapter without mutation or revision bump", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const localWorldId = await createStudioWorld("scene-local");
  const foreignWorldId = await createStudioWorld("scene-foreign");
  context.after(() => query(`DELETE FROM worlds WHERE id = ANY($1::uuid[])`, [[localWorldId, foreignWorldId]]));
  const scene = await query(
    `INSERT INTO scenes (world_id, name) VALUES ($1, 'local-scene') RETURNING id`,
    [localWorldId]
  );
  const chapter = await query(
    `INSERT INTO chapters (world_id, title, sequence) VALUES ($1, 'foreign-chapter', 1) RETURNING id`,
    [foreignWorldId]
  );
  const revisionBefore = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [localWorldId]);

  const response = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${localWorldId}/scenes/${scene.rows[0].id}`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "must-not-save", chapterId: chapter.rows[0].id }
  });
  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().code, "CHAPTER_NOT_FOUND");

  const stored = await query(`SELECT name, chapter_id FROM scenes WHERE id = $1`, [scene.rows[0].id]);
  assert.equal(stored.rows[0].name, "local-scene");
  assert.equal(stored.rows[0].chapter_id, null);
  const revisionAfter = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [localWorldId]);
  assert.equal(revisionAfter.rows[0].content_revision, revisionBefore.rows[0].content_revision);
});

test("transaction editor check holds membership stable until completion", async (context) => {
  const worldId = await createStudioWorld("scene-editor-lock");
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [worldId]));
  const locker = await pool.connect();
  const contender = await pool.connect();
  try {
    await locker.query("BEGIN");
    assert.equal(
      await lockStudioSceneClueEditor(locker, { worldId, actorId: hostUserId }),
      "owner"
    );
    await contender.query(`SET lock_timeout = '100ms'`);
    await assert.rejects(
      contender.query(
        `DELETE FROM world_members WHERE world_id = $1 AND user_id = $2`,
        [worldId, hostUserId]
      ),
      (error) => error.code === "55P03"
    );
  } finally {
    await locker.query("ROLLBACK").catch(() => {});
    await contender.query("RESET lock_timeout").catch(() => {});
    locker.release();
    contender.release();
  }
});

test("chapter validation holds a key-share lock until the write transaction ends", async (context) => {
  const worldId = await createStudioWorld("scene-chapter-lock");
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [worldId]));
  const chapter = await query(
    `INSERT INTO chapters (world_id, title, sequence) VALUES ($1, 'locked-chapter', 1) RETURNING id`,
    [worldId]
  );
  const locker = await pool.connect();
  const contender = await pool.connect();
  try {
    await locker.query("BEGIN");
    const locked = await lockSceneChapterReference(locker, {
      worldId,
      chapterId: chapter.rows[0].id
    });
    assert.equal(locked.id, chapter.rows[0].id);
    await contender.query(`SET lock_timeout = '100ms'`);
    await assert.rejects(
      contender.query(`DELETE FROM chapters WHERE id = $1`, [chapter.rows[0].id]),
      (error) => error.code === "55P03"
    );
  } finally {
    await locker.query("ROLLBACK").catch(() => {});
    await contender.query("RESET lock_timeout").catch(() => {});
    locker.release();
    contender.release();
  }
});
