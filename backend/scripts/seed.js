import { pool } from "../src/db.js";

/** Stable fixture IDs shared with backend tests and smoke scripts. */
const FIXTURE = {
  hostUserId: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
  playerUserId: "1d5e8155-a80f-4e7f-99f0-0ae317a35f35",
  worldId: "08646748-e4ae-446a-a5e7-ce59ca23ffc3",
  roomId: "a65f94eb-a987-463c-bb81-aa482367e54a"
};

const client = await pool.connect();
try {
  await client.query("BEGIN");

  await client.query(
    `INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name`,
    [FIXTURE.hostUserId, "host@zhimu.local", "沈舟"]
  );
  await client.query(
    `INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name`,
    [FIXTURE.playerUserId, "player@zhimu.local", "顾言"]
  );

  await client.query(
    `INSERT INTO worlds (id, owner_user_id, name, summary, status, catalog_public)
     VALUES ($1, $2, '雾港来信', '海雾将旧日的来信送回港口。', 'testing', true)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, summary = EXCLUDED.summary, status = EXCLUDED.status, catalog_public = EXCLUDED.catalog_public`,
    [FIXTURE.worldId, FIXTURE.hostUserId]
  );
  await client.query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')
     ON CONFLICT (world_id, user_id) DO NOTHING`,
    [FIXTURE.worldId, FIXTURE.hostUserId]
  );

  const chapter = await client.query(
    `INSERT INTO chapters (world_id, title, sequence, publication_status) VALUES ($1, '潮声下的名字', 1, 'testing')
     ON CONFLICT (world_id, sequence) DO UPDATE SET title = EXCLUDED.title, publication_status = 'testing'
     RETURNING id`,
    [FIXTURE.worldId]
  );

  const role = await client.query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
     VALUES ($1, '顾言 · 记者', '收到匿名来信后返回雾港。', '父亲十年前在雾港失踪。', 1)
     ON CONFLICT (world_id, sequence) DO UPDATE
     SET name = EXCLUDED.name, public_profile = EXCLUDED.public_profile, private_profile = EXCLUDED.private_profile
     RETURNING id`,
    [FIXTURE.worldId]
  );

  const role2 = await client.query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
     VALUES ($1, '林夏 · 医生', '在雾港经营诊所，对外保持克制。', '你认得旧档案上被涂去的名字。', 2)
     ON CONFLICT (world_id, sequence) DO UPDATE
     SET name = EXCLUDED.name, public_profile = EXCLUDED.public_profile, private_profile = EXCLUDED.private_profile
     RETURNING id`,
    [FIXTURE.worldId]
  );

  const script = await client.query(
    `INSERT INTO character_scripts (role_slot_id, title)
     SELECT $1, '记者的旧日来信'
     WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1)
     RETURNING id`,
    [role.rows[0].id]
  );
  const scriptId = script.rowCount ? script.rows[0].id : (
    await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 LIMIT 1`, [role.rows[0].id])
  ).rows[0].id;

  const first = await client.query(
    `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
     SELECT $1, $2, $3, '抵达档案馆', '馆长将一串沉重的钥匙留在桌面上，便借口整理旧报纸离开。', 1, 'testing'
     WHERE NOT EXISTS (
       SELECT 1 FROM script_sections WHERE role_slot_id = $2 AND chapter_id = $3 AND sequence = 1
     )
     RETURNING id`,
    [scriptId, role.rows[0].id, chapter.rows[0].id]
  );
  const firstSectionId = first.rowCount ? first.rows[0].id : (
    await client.query(
      `SELECT id FROM script_sections WHERE role_slot_id = $1 AND chapter_id = $2 AND sequence = 1`,
      [role.rows[0].id, chapter.rows[0].id]
    )
  ).rows[0].id;

  const second = await client.query(
    `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
     SELECT $1, $2, $3, '被撕去的一页', '盐渍沿着残缺纸页向内蔓延。父亲失踪日期旁边留着明显撕痕。', 2, 'testing'
     WHERE NOT EXISTS (
       SELECT 1 FROM script_sections WHERE role_slot_id = $2 AND chapter_id = $3 AND sequence = 2
     )
     RETURNING id`,
    [scriptId, role.rows[0].id, chapter.rows[0].id]
  );
  const secondSectionId = second.rowCount ? second.rows[0].id : (
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

  await client.query(
    `INSERT INTO rooms (id, world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, $3, '雾港来信 · 测试房', 'FOG-HARBOR-DEMO', 'testing')
     ON CONFLICT (invite_code) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status`,
    [FIXTURE.roomId, FIXTURE.worldId, FIXTURE.hostUserId]
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

  const publicVoice = await client.query(
    `INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
     SELECT $1, '公共讨论房', 'public', $2
     WHERE NOT EXISTS (
       SELECT 1 FROM voice_rooms WHERE room_id = $1 AND room_type = 'public' AND name = '公共讨论房'
     )
     RETURNING id`,
    [FIXTURE.roomId, FIXTURE.hostUserId]
  );
  if (!publicVoice.rowCount) {
    await client.query(
      `SELECT id FROM voice_rooms WHERE room_id = $1 AND room_type = 'public' ORDER BY created_at LIMIT 1`,
      [FIXTURE.roomId]
    );
  }

  const privateVoice = await client.query(
    `INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
     SELECT $1, '密谈房', 'invite_private', $2
     WHERE NOT EXISTS (
       SELECT 1 FROM voice_rooms WHERE room_id = $1 AND room_type = 'invite_private' AND name = '密谈房'
     )
     RETURNING id`,
    [FIXTURE.roomId, FIXTURE.hostUserId]
  );
  const privateVoiceId = privateVoice.rowCount
    ? privateVoice.rows[0].id
    : (
        await client.query(
          `SELECT id FROM voice_rooms WHERE room_id = $1 AND room_type = 'invite_private' AND name = '密谈房' LIMIT 1`,
          [FIXTURE.roomId]
        )
      ).rows[0]?.id;
  if (privateVoiceId) {
    for (const userId of [FIXTURE.hostUserId, FIXTURE.playerUserId]) {
      await client.query(
        `INSERT INTO voice_room_members (voice_room_id, user_id, invited_by_user_id, joined_at)
         VALUES ($1, $2, $3, now()) ON CONFLICT (voice_room_id, user_id) DO NOTHING`,
        [privateVoiceId, userId, FIXTURE.hostUserId]
      );
    }
  }

  await client.query(
    `INSERT INTO automation_rules (world_id, room_id, name, conditions, actions)
     SELECT $1, $2, '读完首章后解锁第二章', $3::jsonb, $4::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM automation_rules WHERE room_id = $2 AND name = '读完首章后解锁第二章')`,
    [
      FIXTURE.worldId,
      FIXTURE.roomId,
      JSON.stringify({ all: [{ type: "reading_completed", roleSlotId: role.rows[0].id, scriptSectionId: firstSectionId }] }),
      JSON.stringify([
        { type: "unlock_script_section", scriptSectionId: secondSectionId },
        { type: "timeline_log", message: "顾言的下一段私人剧情已解锁" }
      ])
    ]
  );

  await client.query("COMMIT");
  console.log({
    hostUserId: FIXTURE.hostUserId,
    playerUserId: FIXTURE.playerUserId,
    worldId: FIXTURE.worldId,
    roomId: FIXTURE.roomId
  });
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
