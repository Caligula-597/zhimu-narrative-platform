import assert from "node:assert/strict";
import test from "node:test";
import { query } from "../src/db.js";
import { joinPublicCatalogWorld } from "../src/catalog-join-service.js";
import { hostUserId, playerUserId } from "./helpers/fixture-ids.js";

test("joinPublicCatalogWorld rejects non-public worlds", async () => {
  const suffix = `${Date.now()}`;
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status, catalog_public)
     VALUES ($1, $2, 'private fixture', 'testing', false)
     RETURNING id`,
    [hostUserId, `非公开 ${suffix}`]
  );
  try {
    await assert.rejects(
      () => joinPublicCatalogWorld(playerUserId, world.rows[0].id),
      (error) => error.code === "CATALOG_NOT_PUBLIC"
    );
  } finally {
    await query(`DELETE FROM worlds WHERE id = $1`, [world.rows[0].id]);
  }
});

test("joinPublicCatalogWorld promotes viewer to host and provisions room", async () => {
  const suffix = `promote-${Date.now()}`;
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status, catalog_public, catalog_review_status)
     VALUES ($1, $2, 'join service fixture', 'testing', true, 'approved')
     RETURNING id, name`,
    [hostUserId, `公开 ${suffix}`]
  );
  await query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`, [
    world.rows[0].id,
    hostUserId
  ]);
  await query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'viewer')`,
    [world.rows[0].id, playerUserId]
  );
  await query(`INSERT INTO role_slots (world_id, name, sequence) VALUES ($1, '角色', 1)`, [
    world.rows[0].id
  ]);

  try {
    const result = await joinPublicCatalogWorld(playerUserId, world.rows[0].id);
    assert.equal(result.membershipRole, "host");
    assert.ok(result.room?.id);

    const role = await query(
      `SELECT role FROM world_members WHERE world_id = $1 AND user_id = $2`,
      [world.rows[0].id, playerUserId]
    );
    assert.equal(role.rows[0].role, "host");
  } finally {
    await query(`DELETE FROM voice_rooms WHERE room_id IN (SELECT id FROM rooms WHERE world_id = $1)`, [
      world.rows[0].id
    ]);
    await query(`DELETE FROM room_members WHERE room_id IN (SELECT id FROM rooms WHERE world_id = $1)`, [
      world.rows[0].id
    ]);
    await query(`DELETE FROM rooms WHERE world_id = $1`, [world.rows[0].id]);
    await query(`DELETE FROM world_members WHERE world_id = $1`, [world.rows[0].id]);
    await query(`DELETE FROM role_slots WHERE world_id = $1`, [world.rows[0].id]);
    await query(`DELETE FROM worlds WHERE id = $1`, [world.rows[0].id]);
  }
});
