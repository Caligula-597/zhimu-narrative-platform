/**
 * Idempotently create the E2E parallel room and copy runtime template from雾港 demo.
 * World content (scenes/clues) is shared; player progress is room-isolated.
 */
import { E2E } from "./constants.mjs";

export async function provisionE2eRoom(client) {
  const world = await one(
    client,
    `SELECT id FROM worlds WHERE id = $1`,
    [E2E.worldId]
  );

  const role = await one(
    client,
    `SELECT id FROM role_slots WHERE world_id = $1 ORDER BY sequence LIMIT 1`,
    [world.id]
  );

  const sections = await client.query(
    `SELECT id, sequence FROM script_sections WHERE role_slot_id = $1 ORDER BY sequence`,
    [role.id]
  );
  const firstSectionId = sections.rows[0]?.id;
  const secondSectionId = sections.rows[1]?.id;
  if (!firstSectionId || !secondSectionId) {
    throw new Error("E2E room needs two script sections — run db:seed first");
  }

  await client.query(
    `INSERT INTO rooms (id, world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, $3, $4, $5, 'testing')
     ON CONFLICT (invite_code) DO UPDATE
     SET name = EXCLUDED.name, status = EXCLUDED.status, host_user_id = EXCLUDED.host_user_id`,
    [E2E.roomId, E2E.worldId, E2E.hostUserId, E2E.roomName, E2E.inviteCode]
  );

  await client.query(
    `INSERT INTO room_members (room_id, user_id, member_type)
     VALUES ($1, $2, 'host')
     ON CONFLICT (room_id, user_id) DO UPDATE
     SET member_type = EXCLUDED.member_type, status = 'active', role_slot_id = NULL`,
    [E2E.roomId, E2E.hostUserId]
  );

  await client.query(
    `INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
     SELECT $1, '公共讨论房', 'public', $2
     WHERE NOT EXISTS (
       SELECT 1 FROM voice_rooms WHERE room_id = $1 AND room_type = 'public' AND name = '公共讨论房'
     )`,
    [E2E.roomId, E2E.hostUserId]
  );

  await client.query(
    `INSERT INTO automation_rules (world_id, room_id, name, conditions, actions)
     SELECT $1, $2, '读完首章后解锁第二章', $3::jsonb, $4::jsonb
     WHERE NOT EXISTS (
       SELECT 1 FROM automation_rules WHERE room_id = $2 AND name = '读完首章后解锁第二章'
     )`,
    [
      E2E.worldId,
      E2E.roomId,
      JSON.stringify({
        all: [{ type: "reading_completed", roleSlotId: role.id, scriptSectionId: firstSectionId }]
      }),
      JSON.stringify([
        { type: "unlock_script_section", scriptSectionId: secondSectionId },
        { type: "timeline_log", message: "E2E · 第二章已解锁" }
      ])
    ]
  );

  const archive = await one(
    client,
    `SELECT id FROM scenes WHERE world_id = $1 AND metadata->>'seedKey' = 'fog-archive'`,
    [E2E.worldId]
  );
  const secretRoom = await one(
    client,
    `SELECT id FROM scenes WHERE world_id = $1 AND metadata->>'seedKey' = 'fog-secret-room'`,
    [E2E.worldId]
  );
  const clue = await one(
    client,
    `SELECT id FROM clues WHERE world_id = $1 AND metadata->>'seedKey' = 'fog-shipping-log'`,
    [E2E.worldId]
  );

  await client.query(
    `INSERT INTO room_content_unlocks (room_id, content_type, content_id)
     VALUES ($1, 'scene', $2)
     ON CONFLICT (room_id, content_type, content_id) DO NOTHING`,
    [E2E.roomId, archive.id]
  );

  await client.query(
    `INSERT INTO automation_rules (world_id, room_id, name, mode, priority, conditions, actions)
     SELECT $1, $2, '馆长交付手记：开放档案密室', 'host_confirm', 50,
       jsonb_build_object('all', jsonb_build_array(jsonb_build_object(
         'type', 'clue_owned', 'roleSlotId', $3::text, 'clueId', $4::text
       ))),
       jsonb_build_array(
         jsonb_build_object('type', 'unlock_scene', 'sceneId', $5::text),
         jsonb_build_object('type', 'timeline_log', 'message', 'E2E · 主持人确认开放档案密室')
       )
     WHERE NOT EXISTS (
       SELECT 1 FROM automation_rules WHERE room_id = $2 AND name = '馆长交付手记：开放档案密室'
     )`,
    [E2E.worldId, E2E.roomId, role.id, clue.id, secretRoom.id]
  );

  return {
    worldId: E2E.worldId,
    roomId: E2E.roomId,
    inviteCode: E2E.inviteCode,
    roleId: role.id,
    firstSectionId,
    secondSectionId
  };
}

async function one(client, sql, params) {
  const result = await client.query(sql, params);
  if (!result.rowCount) throw new Error(`E2E provision missing dependency: ${sql}`);
  return result.rows[0];
}
