import { pool } from "../src/db.js";

const client = await pool.connect();

async function one(sql, params = []) {
  const result = await client.query(sql, params);
  if (!result.rowCount) throw new Error(`Seed dependency missing: ${sql}`);
  return result.rows[0];
}

try {
  await client.query("BEGIN");

  const world = await one(`SELECT id FROM worlds WHERE name = '雾港来信' ORDER BY created_at LIMIT 1`);
  const room = await one(`SELECT id FROM rooms WHERE world_id = $1 ORDER BY created_at LIMIT 1`, [world.id]);
  const role = await one(`SELECT id FROM role_slots WHERE world_id = $1 ORDER BY sequence LIMIT 1`, [world.id]);

  const archive = await one(
    `INSERT INTO scenes (world_id, name, public_text, host_text, metadata)
     SELECT $1, '旧港档案馆', '海潮味渗进老木柜。馆内的报纸按年份码放，最里侧的旧报架有一层明显被翻动过。', '初始探索场景。', '{"seedKey":"fog-archive"}'::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM scenes WHERE world_id = $1 AND metadata->>'seedKey' = 'fog-archive')
     RETURNING id`,
    [world.id]
  ).catch(async () => one(`SELECT id FROM scenes WHERE world_id = $1 AND metadata->>'seedKey' = 'fog-archive'`, [world.id]));

  const secretRoom = await one(
    `INSERT INTO scenes (world_id, name, public_text, host_text, metadata)
     SELECT $1, '档案密室', '馆长移开木柜，露出一道向下的窄门。潮湿的密室里堆着从未进入公开目录的航运档案。', '主持确认后开放。', '{"seedKey":"fog-secret-room"}'::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM scenes WHERE world_id = $1 AND metadata->>'seedKey' = 'fog-secret-room')
     RETURNING id`,
    [world.id]
  ).catch(async () => one(`SELECT id FROM scenes WHERE world_id = $1 AND metadata->>'seedKey' = 'fog-secret-room'`, [world.id]));

  const clue = await one(
    `INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata)
     SELECT $1, '被撕去一页的航运录', '残页记录着一艘不存在于公开名单中的货轮。页脚用铅笔写着：潮落后，去找馆长。', '核心线索，触发主持确认事件。', 'role', '{"seedKey":"fog-shipping-log"}'::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM clues WHERE world_id = $1 AND metadata->>'seedKey' = 'fog-shipping-log')
     RETURNING id`,
    [world.id]
  ).catch(async () => one(`SELECT id FROM clues WHERE world_id = $1 AND metadata->>'seedKey' = 'fog-shipping-log'`, [world.id]));

  await client.query(
    `INSERT INTO investigation_points
      (world_id, scene_id, name, description, interaction_text, result_text, clue_id, sequence, metadata)
     SELECT $1, $2, '旧报架', '最里侧的旧报架上有一摞没有编号的报纸。', '翻开夹层里的旧报纸。', '你在夹层里找到一页被匆忙撕下的航运录。', $3, 1, '{"seedKey":"fog-newspaper-rack"}'::jsonb
     WHERE NOT EXISTS (
       SELECT 1 FROM investigation_points WHERE world_id = $1 AND metadata->>'seedKey' = 'fog-newspaper-rack'
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
     SELECT $1, $2, '馆长交付手记：开放档案密室', 'host_confirm', 50,
       jsonb_build_object('all', jsonb_build_array(jsonb_build_object(
         'type', 'clue_owned', 'roleSlotId', $3::text, 'clueId', $4::text
       ))),
       jsonb_build_array(
         jsonb_build_object('type', 'unlock_scene', 'sceneId', $5::text),
         jsonb_build_object('type', 'timeline_log', 'message', '主持人确认开放档案密室')
       )
     WHERE NOT EXISTS (
       SELECT 1 FROM automation_rules WHERE room_id = $2 AND name = '馆长交付手记：开放档案密室'
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
