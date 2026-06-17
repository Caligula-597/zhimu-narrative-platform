import { pool } from "../src/db.js";
import { FIXTURE } from "./fixture-constants.mjs";

const client = await pool.connect();

async function one(sql, params = []) {
  const result = await client.query(sql, params);
  if (!result.rowCount) throw new Error(`Seed dependency missing: ${sql}`);
  return result.rows[0];
}

try {
  await client.query("BEGIN");

  const world = await one(`SELECT id FROM worlds WHERE id = $1`, [FIXTURE.worldId]);
  const room = await one(`SELECT id FROM rooms WHERE id = $1`, [FIXTURE.roomId]);
  const role = await one(`SELECT id FROM role_slots WHERE world_id = $1 ORDER BY sequence LIMIT 1`, [world.id]);

  const archive = await one(
    `INSERT INTO scenes (world_id, name, public_text, host_text, metadata)
     SELECT $1, '场景 A', '公开探索场景 A。', '初始探索场景。', '{"seedKey":"fixture-scene-a"}'::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM scenes WHERE world_id = $1 AND metadata->>'seedKey' = 'fixture-scene-a')
     RETURNING id`,
    [world.id]
  ).catch(async () => one(`SELECT id FROM scenes WHERE world_id = $1 AND metadata->>'seedKey' = 'fixture-scene-a'`, [world.id]));

  const secretRoom = await one(
    `INSERT INTO scenes (world_id, name, public_text, host_text, metadata)
     SELECT $1, '场景 B', '需要主持确认后开放。', '主持确认后开放。', '{"seedKey":"fixture-scene-b"}'::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM scenes WHERE world_id = $1 AND metadata->>'seedKey' = 'fixture-scene-b')
     RETURNING id`,
    [world.id]
  ).catch(async () => one(`SELECT id FROM scenes WHERE world_id = $1 AND metadata->>'seedKey' = 'fixture-scene-b'`, [world.id]));

  const clue = await one(
    `INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata)
     SELECT $1, '测试线索', '测试用线索描述。', '核心线索。', 'role', '{"seedKey":"fixture-clue"}'::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM clues WHERE world_id = $1 AND metadata->>'seedKey' = 'fixture-clue')
     RETURNING id`,
    [world.id]
  ).catch(async () => one(`SELECT id FROM clues WHERE world_id = $1 AND metadata->>'seedKey' = 'fixture-clue'`, [world.id]));

  await one(
    `INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata)
     SELECT $1, '实体卡测试线索', '供 physical-token 测试激活。', '不预置归属。', 'role', '{"seedKey":"fixture-clue-token"}'::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM clues WHERE world_id = $1 AND metadata->>'seedKey' = 'fixture-clue-token')
     RETURNING id`,
    [world.id]
  ).catch(async () => one(`SELECT id FROM clues WHERE world_id = $1 AND metadata->>'seedKey' = 'fixture-clue-token'`, [world.id]));

  await client.query(
    `INSERT INTO investigation_points
      (world_id, scene_id, name, description, interaction_text, result_text, clue_id, sequence, metadata)
     SELECT $1, $2, '调查点 A', '测试调查点。', '进行调查。', '获得测试线索。', $3, 1, '{"seedKey":"fixture-point-a"}'::jsonb
     WHERE NOT EXISTS (
       SELECT 1 FROM investigation_points WHERE world_id = $1 AND metadata->>'seedKey' = 'fixture-point-a'
     )`,
    [world.id, archive.id, clue.id]
  );

  await client.query(
    `INSERT INTO room_content_unlocks (room_id, content_type, content_id)
     VALUES ($1, 'scene', $2)
     ON CONFLICT (room_id, content_type, content_id) DO NOTHING`,
    [room.id, archive.id]
  );

  await client.query(
    `INSERT INTO automation_rules (world_id, room_id, name, mode, priority, conditions, actions)
     SELECT $1, $2, '线索解锁场景 B', 'host_confirm', 50,
       jsonb_build_object('all', jsonb_build_array(jsonb_build_object(
         'type', 'clue_owned', 'roleSlotId', $3::text, 'clueId', $4::text
       ))),
       jsonb_build_array(
         jsonb_build_object('type', 'unlock_scene', 'sceneId', $5::text),
         jsonb_build_object('type', 'timeline_log', 'message', '场景 B 已开放')
       )
     WHERE NOT EXISTS (
       SELECT 1 FROM automation_rules WHERE room_id = $2 AND name = '线索解锁场景 B'
     )`,
    [world.id, room.id, role.id, clue.id, secretRoom.id]
  );

  await client.query("COMMIT");
  console.log(JSON.stringify({ ok: true, worldId: world.id, roomId: room.id, roleId: role.id }, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
