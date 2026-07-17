/**
 * Remove ephemeral play-test room members so invite-code E2E can pick roles.
 * Keeps host + seed fixture player (Role A) from db:seed.
 */
import { pool } from "../src/db.js";
import { FIXTURE } from "./fixture-constants.mjs";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(
    `DELETE FROM room_members
     WHERE room_id = $1
       AND user_id NOT IN ($2, $3)`,
    [FIXTURE.roomId, FIXTURE.hostUserId, FIXTURE.playerUserId]
  );
  await client.query(
    `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id, status)
     VALUES ($1, $2, 'host', NULL, 'active')
     ON CONFLICT (room_id, user_id) DO UPDATE SET
       member_type = 'host',
       role_slot_id = NULL,
       status = 'active',
       joined_at = COALESCE(room_members.joined_at, now())`,
    [FIXTURE.roomId, FIXTURE.hostUserId]
  );
  await client.query(
    `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id, status)
     SELECT $1, $2, 'player', rs.id, 'active'
     FROM role_slots rs
     WHERE rs.world_id = $3
     ORDER BY rs.sequence, rs.id
     LIMIT 1
     ON CONFLICT (room_id, user_id) DO UPDATE SET
       member_type = 'player',
       role_slot_id = EXCLUDED.role_slot_id,
       status = 'active',
       joined_at = COALESCE(room_members.joined_at, now())`,
    [FIXTURE.roomId, FIXTURE.playerUserId, FIXTURE.worldId]
  );
  await client.query(`DELETE FROM reading_progress WHERE room_id = $1`, [FIXTURE.roomId]);
  await client.query(`DELETE FROM clue_ownership WHERE room_id = $1`, [FIXTURE.roomId]);
  await client.query(
    `DELETE FROM pending_host_events WHERE room_id = $1`,
    [FIXTURE.roomId]
  );
  await client.query(
    `INSERT INTO pending_host_events (room_id, event_key, title, description, actions, status)
     VALUES ($1, 'seed-fixture-pending', '【演示】待确认推进', 'seed 用于主持台演示与 E2E', '[]'::jsonb, 'pending')`,
    [FIXTURE.roomId]
  );
  await client.query(
    `INSERT INTO worlds (id, owner_user_id, name, summary, status, catalog_public, catalog_review_status)
     VALUES ($1, $2, 'E2E 官方示例', '端到端测试专用官方示例，不作为生产 seed。', 'testing', true, 'approved')
     ON CONFLICT (id) DO UPDATE SET
       owner_user_id = EXCLUDED.owner_user_id,
       name = EXCLUDED.name,
       summary = EXCLUDED.summary,
       status = EXCLUDED.status,
       catalog_public = true,
       catalog_review_status = 'approved',
       updated_at = now()`,
    [FIXTURE.officialExampleWorldId, FIXTURE.hostUserId]
  );
  await client.query(
    `INSERT INTO world_members (world_id, user_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT (world_id, user_id) DO UPDATE SET role = 'owner'`,
    [FIXTURE.officialExampleWorldId, FIXTURE.hostUserId]
  );
  const officialChapter = await client.query(
    `INSERT INTO chapters (world_id, title, sequence, publication_status)
     VALUES ($1, '官方示例第一章', 1, 'testing')
     ON CONFLICT (world_id, sequence) DO UPDATE SET title = EXCLUDED.title, publication_status = 'testing'
     RETURNING id`,
    [FIXTURE.officialExampleWorldId]
  );
  const officialRole = await client.query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
     VALUES ($1, '体验角色', '适合快速体验玩家端流程。', '你知道这是一个端到端测试席位。', 1)
     ON CONFLICT (world_id, sequence) DO UPDATE
     SET name = EXCLUDED.name,
         public_profile = EXCLUDED.public_profile,
         private_profile = EXCLUDED.private_profile
     RETURNING id`,
    [FIXTURE.officialExampleWorldId]
  );
  const script = await client.query(
    `INSERT INTO character_scripts (role_slot_id, title)
     SELECT $1, '体验角色 · 私人剧本'
     WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1)
     RETURNING id`,
    [officialRole.rows[0].id]
  );
  const scriptId = script.rows[0]?.id ?? (
    await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1`, [
      officialRole.rows[0].id
    ])
  ).rows[0].id;
  await client.query(
    `INSERT INTO script_sections
       (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
     SELECT $1, $2, $3, '抵达织幕', '这是官方示例 E2E 的第一段剧情。', 1, 'testing'
     WHERE NOT EXISTS (
       SELECT 1 FROM script_sections WHERE role_slot_id = $2 AND chapter_id = $3 AND sequence = 1
     )`,
    [scriptId, officialRole.rows[0].id, officialChapter.rows[0].id]
  );
  await client.query("COMMIT");
  console.log(JSON.stringify({
    ok: true,
    roomId: FIXTURE.roomId,
    officialExampleWorldId: FIXTURE.officialExampleWorldId
  }, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
