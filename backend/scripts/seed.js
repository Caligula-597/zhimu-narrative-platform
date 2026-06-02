import { pool } from "../src/db.js";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  const host = await client.query(
    `INSERT INTO users (email, display_name) VALUES ('host@zhimu.local', '沈舟')
     ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id`
  );
  const player = await client.query(
    `INSERT INTO users (email, display_name) VALUES ('player@zhimu.local', '顾言')
     ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id`
  );
  const world = await client.query(
    `INSERT INTO worlds (owner_user_id, name, summary, status)
     VALUES ($1, '雾港来信', '海雾将旧日的来信送回港口。', 'testing') RETURNING id`,
    [host.rows[0].id]
  );
  await client.query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`, [world.rows[0].id, host.rows[0].id]);
  const chapter = await client.query(`INSERT INTO chapters (world_id, title, sequence) VALUES ($1, '潮声下的名字', 1) RETURNING id`, [world.rows[0].id]);
  const role = await client.query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
     VALUES ($1, '顾言 · 记者', '收到匿名来信后返回雾港。', '父亲十年前在雾港失踪。', 1) RETURNING id`,
    [world.rows[0].id]
  );
  const script = await client.query(`INSERT INTO character_scripts (role_slot_id, title) VALUES ($1, '记者的旧日来信') RETURNING id`, [role.rows[0].id]);
  const first = await client.query(
    `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence)
     VALUES ($1, $2, $3, '抵达档案馆', '馆长将一串沉重的钥匙留在桌面上，便借口整理旧报纸离开。', 1) RETURNING id`,
    [script.rows[0].id, role.rows[0].id, chapter.rows[0].id]
  );
  const second = await client.query(
    `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence)
     VALUES ($1, $2, $3, '被撕去的一页', '盐渍沿着残缺纸页向内蔓延。父亲失踪日期旁边留着明显撕痕。', 2) RETURNING id`,
    [script.rows[0].id, role.rows[0].id, chapter.rows[0].id]
  );
  const room = await client.query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, '雾港来信 · 测试房', 'FOG-HARBOR-DEMO', 'testing') RETURNING id`,
    [world.rows[0].id, host.rows[0].id]
  );
  await client.query(`INSERT INTO room_members (room_id, user_id, member_type) VALUES ($1, $2, 'host')`, [room.rows[0].id, host.rows[0].id]);
  await client.query(`INSERT INTO room_members (room_id, user_id, member_type, role_slot_id) VALUES ($1, $2, 'player', $3)`, [room.rows[0].id, player.rows[0].id, role.rows[0].id]);
  await client.query(`INSERT INTO player_states (room_id, role_slot_id) VALUES ($1, $2)`, [room.rows[0].id, role.rows[0].id]);
  await client.query(`INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id) VALUES ($1, '公共讨论房', 'public', $2)`, [room.rows[0].id, host.rows[0].id]);
  await client.query(
    `INSERT INTO automation_rules (world_id, room_id, name, conditions, actions)
     VALUES ($1, $2, '读完首章后解锁第二章', $3::jsonb, $4::jsonb)`,
    [
      world.rows[0].id,
      room.rows[0].id,
      JSON.stringify({ all: [{ type: "reading_completed", roleSlotId: role.rows[0].id, scriptSectionId: first.rows[0].id }] }),
      JSON.stringify([{ type: "unlock_script_section", scriptSectionId: second.rows[0].id }, { type: "timeline_log", message: "顾言的下一段私人剧情已解锁" }])
    ]
  );
  await client.query("COMMIT");
  console.log({ hostUserId: host.rows[0].id, playerUserId: player.rows[0].id, roomId: room.rows[0].id });
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
