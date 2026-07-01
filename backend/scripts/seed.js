import { pool } from "../src/db.js";
import { FIXTURE } from "./fixture-constants.mjs";

const client = await pool.connect();
try {
  await client.query("BEGIN");

  await client.query(
    `INSERT INTO users (id, email, display_name, user_kind, email_verified_at) VALUES ($1, $2, $3, 'registered', now())
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       display_name = EXCLUDED.display_name,
       user_kind = 'registered',
       email_verified_at = COALESCE(users.email_verified_at, now())`,
    [FIXTURE.hostUserId, "host@zhimu.local", "沈舟"]
  );
  await client.query(
    `INSERT INTO users (id, email, display_name, user_kind, email_verified_at) VALUES ($1, $2, $3, 'registered', now())
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       display_name = EXCLUDED.display_name,
       user_kind = 'registered',
       email_verified_at = COALESCE(users.email_verified_at, now())`,
    [FIXTURE.playerUserId, "player@zhimu.local", "顾言"]
  );

  for (const userId of [FIXTURE.hostUserId, FIXTURE.playerUserId]) {
    await client.query(
      `INSERT INTO user_plans (user_id, plan_code) VALUES ($1, 'beta')
       ON CONFLICT (user_id) DO UPDATE SET plan_code = 'beta', updated_at = now()`,
      [userId]
    );
  }

  await client.query(
    `INSERT INTO worlds (id, owner_user_id, name, summary, status, catalog_public, catalog_review_status)
     VALUES ($1, $2, $3, '后端集成测试用最小剧本。', 'testing', true, 'approved')
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       status = EXCLUDED.status,
       summary = EXCLUDED.summary,
       catalog_public = false,
       catalog_review_status = 'none'`,
    [FIXTURE.worldId, FIXTURE.hostUserId, FIXTURE.worldName]
  );
  await client.query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')
     ON CONFLICT (world_id, user_id) DO NOTHING`,
    [FIXTURE.worldId, FIXTURE.hostUserId]
  );
  await client.query(
    `UPDATE worlds
     SET catalog_public = false,
         catalog_review_status = 'none'
     WHERE id = $1`,
    [FIXTURE.worldId]
  );

  const chapter = await client.query(
    `INSERT INTO chapters (world_id, title, sequence, publication_status) VALUES ($1, '第一章', 1, 'testing')
     ON CONFLICT (world_id, sequence) DO UPDATE SET title = EXCLUDED.title, publication_status = 'testing'
     RETURNING id`,
    [FIXTURE.worldId]
  );

  const role = await client.query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
     VALUES ($1, '角色 A', '公开人设 A。', '私密背景 A。', 1)
     ON CONFLICT (world_id, sequence) DO UPDATE
     SET name = EXCLUDED.name, public_profile = EXCLUDED.public_profile, private_profile = EXCLUDED.private_profile
     RETURNING id`,
    [FIXTURE.worldId]
  );

  const role2 = await client.query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
     VALUES ($1, '角色 B', '公开人设 B。', '私密背景 B。', 2)
     ON CONFLICT (world_id, sequence) DO UPDATE
     SET name = EXCLUDED.name, public_profile = EXCLUDED.public_profile, private_profile = EXCLUDED.private_profile
     RETURNING id`,
    [FIXTURE.worldId]
  );

  const script = await client.query(
    `INSERT INTO character_scripts (role_slot_id, title)
     SELECT $1, '角色 A 剧本'
     WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1)
     RETURNING id`,
    [role.rows[0].id]
  );
  const scriptId = script.rowCount
    ? script.rows[0].id
    : (await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 LIMIT 1`, [role.rows[0].id])).rows[0].id;

  const first = await client.query(
    `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
     SELECT $1, $2, $3, '段落一', '测试段落一正文。', 1, 'testing'
     WHERE NOT EXISTS (
       SELECT 1 FROM script_sections WHERE role_slot_id = $2 AND chapter_id = $3 AND sequence = 1
     )
     RETURNING id`,
    [scriptId, role.rows[0].id, chapter.rows[0].id]
  );
  const firstSectionId = first.rowCount
    ? first.rows[0].id
    : (
        await client.query(
          `SELECT id FROM script_sections WHERE role_slot_id = $1 AND chapter_id = $2 AND sequence = 1`,
          [role.rows[0].id, chapter.rows[0].id]
        )
      ).rows[0].id;

  const second = await client.query(
    `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
     SELECT $1, $2, $3, '段落二', '测试段落二正文。', 2, 'testing'
     WHERE NOT EXISTS (
       SELECT 1 FROM script_sections WHERE role_slot_id = $2 AND chapter_id = $3 AND sequence = 2
     )
     RETURNING id`,
    [scriptId, role.rows[0].id, chapter.rows[0].id]
  );
  const secondSectionId = second.rowCount
    ? second.rows[0].id
    : (
        await client.query(
          `SELECT id FROM script_sections WHERE role_slot_id = $1 AND chapter_id = $2 AND sequence = 2`,
          [role.rows[0].id, chapter.rows[0].id]
        )
      ).rows[0].id;

  await client.query(
    `UPDATE script_sections SET publication_status = 'testing'
     WHERE role_slot_id = $1 AND publication_status <> 'testing'`,
    [role.rows[0].id]
  );

  const script2 = await client.query(
    `INSERT INTO character_scripts (role_slot_id, title)
     SELECT $1, '角色 B 剧本'
     WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1)
     RETURNING id`,
    [role2.rows[0].id]
  );
  const script2Id = script2.rowCount
    ? script2.rows[0].id
    : (await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 LIMIT 1`, [role2.rows[0].id])).rows[0].id;

  await client.query(
    `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
     SELECT $1, $2, $3, '段落一', '角色 B 测试段落。', 1, 'testing'
     WHERE NOT EXISTS (
       SELECT 1 FROM script_sections WHERE role_slot_id = $2 AND chapter_id = $3 AND sequence = 1
     )`,
    [script2Id, role2.rows[0].id, chapter.rows[0].id]
  );

  await client.query(
    `INSERT INTO rooms (id, world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, $3, $4, $5, 'testing')
     ON CONFLICT (invite_code) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, world_id = EXCLUDED.world_id`,
    [FIXTURE.roomId, FIXTURE.worldId, FIXTURE.hostUserId, FIXTURE.roomName, FIXTURE.inviteCode]
  );
  await client.query(
    `INSERT INTO room_members (room_id, user_id, member_type) VALUES ($1, $2, 'host')
     ON CONFLICT (room_id, user_id) DO UPDATE SET member_type = EXCLUDED.member_type, status = 'active'`,
    [FIXTURE.roomId, FIXTURE.hostUserId]
  );
  await client.query(
    `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id) VALUES ($1, $2, 'player', $3)
     ON CONFLICT (room_id, user_id) DO UPDATE
     SET member_type = EXCLUDED.member_type, role_slot_id = EXCLUDED.role_slot_id, status = 'active'`,
    [FIXTURE.roomId, FIXTURE.playerUserId, role.rows[0].id]
  );
  await client.query(
    `INSERT INTO player_states (room_id, role_slot_id) VALUES ($1, $2)
     ON CONFLICT (room_id, role_slot_id) DO NOTHING`,
    [FIXTURE.roomId, role.rows[0].id]
  );
  await client.query(
    `INSERT INTO player_states (room_id, role_slot_id) VALUES ($1, $2)
     ON CONFLICT (room_id, role_slot_id) DO NOTHING`,
    [FIXTURE.roomId, role2.rows[0].id]
  );

  await client.query(
    `INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
     SELECT $1, '公共语音', 'public', $2
     WHERE NOT EXISTS (
       SELECT 1 FROM voice_rooms WHERE room_id = $1 AND room_type = 'public'
     )`,
    [FIXTURE.roomId, FIXTURE.hostUserId]
  );

  await client.query(
    `INSERT INTO automation_rules (world_id, room_id, name, conditions, actions)
     SELECT $1, $2, '读完首段后解锁第二段', $3::jsonb, $4::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM automation_rules WHERE room_id = $2 AND name = '读完首段后解锁第二段')`,
    [
      FIXTURE.worldId,
      FIXTURE.roomId,
      JSON.stringify({
        all: [{ type: "reading_completed", roleSlotId: role.rows[0].id, scriptSectionId: firstSectionId }]
      }),
      JSON.stringify([
        { type: "unlock_script_section", scriptSectionId: secondSectionId },
        { type: "timeline_log", message: "第二段剧情已解锁" }
      ])
    ]
  );

  await client.query(
    `INSERT INTO pending_host_events (room_id, event_key, title, description, actions, status)
     SELECT $1, 'seed-fixture-pending', '【演示】待确认推进', 'seed 用于主持台演示与 E2E', '[]'::jsonb, 'pending'
     WHERE NOT EXISTS (
       SELECT 1 FROM pending_host_events WHERE room_id = $1 AND status = 'pending'
     )`,
    [FIXTURE.roomId]
  );

  await client.query("COMMIT");
  console.log(FIXTURE);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
