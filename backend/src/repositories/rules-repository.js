import { query } from "../db.js";

export async function configureRulesTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '30000ms', true)`
  );
}

export async function lockRulesEditor(client, { worldId, actorId }) {
  const result = await client.query(
    `SELECT world_member.role
     FROM worlds world
     JOIN world_members world_member
       ON world_member.world_id = world.id AND world_member.user_id = $2
     WHERE world.id = $1
     FOR KEY SHARE OF world
     FOR SHARE OF world_member`,
    [worldId, actorId]
  );
  return result.rows[0]?.role ?? null;
}

export async function lockRuleRoom(client, { worldId, roomId }) {
  if (!roomId) return true;
  const result = await client.query(
    `SELECT id FROM rooms
     WHERE id = $1 AND world_id = $2
     FOR KEY SHARE`,
    [roomId, worldId]
  );
  return result.rowCount > 0;
}

export async function lockRuleReferences(client, {
  worldId,
  roleSlotIds,
  scriptSectionIds,
  sceneIds,
  clueIds,
  investigationPointIds,
  itemIds
}) {
  await client.query(
    `WITH locked_roles AS MATERIALIZED (
       SELECT role_slot.id
       FROM role_slots role_slot
       WHERE role_slot.world_id = $1 AND role_slot.id = ANY($2::uuid[])
       FOR KEY SHARE
     ), locked_sections AS MATERIALIZED (
       SELECT section.id
       FROM script_sections section
       JOIN role_slots role_slot ON role_slot.id = section.role_slot_id
       WHERE role_slot.world_id = $1 AND section.id = ANY($3::uuid[])
       FOR KEY SHARE OF section, role_slot
     ), locked_scenes AS MATERIALIZED (
       SELECT scene.id
       FROM scenes scene
       WHERE scene.world_id = $1 AND scene.id = ANY($4::uuid[])
       FOR KEY SHARE
     ), locked_clues AS MATERIALIZED (
       SELECT clue.id
       FROM clues clue
       WHERE clue.world_id = $1 AND clue.id = ANY($5::uuid[])
       FOR KEY SHARE
     ), locked_points AS MATERIALIZED (
       SELECT point.id
       FROM investigation_points point
       WHERE point.world_id = $1 AND point.id = ANY($6::uuid[])
       FOR KEY SHARE
     ), locked_items AS MATERIALIZED (
       SELECT item.id
       FROM items item
       WHERE item.world_id = $1 AND item.id = ANY($7::uuid[])
       FOR KEY SHARE
     )
     SELECT
       (SELECT COUNT(*) FROM locked_roles) AS role_count,
       (SELECT COUNT(*) FROM locked_sections) AS section_count,
       (SELECT COUNT(*) FROM locked_scenes) AS scene_count,
       (SELECT COUNT(*) FROM locked_clues) AS clue_count,
       (SELECT COUNT(*) FROM locked_points) AS point_count,
       (SELECT COUNT(*) FROM locked_items) AS item_count`,
    [
      worldId,
      roleSlotIds,
      scriptSectionIds,
      sceneIds,
      clueIds,
      investigationPointIds,
      itemIds
    ]
  );
}

export async function insertRule(client, {
  worldId,
  roomId,
  name,
  mode,
  priority,
  enabled,
  conditions,
  actions,
  metadata
}) {
  const result = await client.query(
    `INSERT INTO automation_rules
       (world_id, room_id, name, mode, priority, enabled, conditions, actions, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)
     RETURNING *`,
    [
      worldId,
      roomId,
      name,
      mode,
      priority,
      enabled,
      JSON.stringify(conditions),
      JSON.stringify(actions),
      JSON.stringify(metadata)
    ]
  );
  return result.rows[0];
}

export async function replaceRule(client, {
  worldId,
  ruleId,
  roomId,
  name,
  mode,
  priority,
  enabled,
  conditions,
  actions,
  metadata
}) {
  const result = await client.query(
    `UPDATE automation_rules
     SET room_id = $1,
         name = $2,
         mode = $3,
         priority = $4,
         enabled = $5,
         conditions = $6::jsonb,
         actions = $7::jsonb,
         metadata = COALESCE(metadata, '{}'::jsonb) || $8::jsonb,
         updated_at = now()
     WHERE id = $9 AND world_id = $10
     RETURNING *`,
    [
      roomId,
      name,
      mode,
      priority,
      enabled,
      JSON.stringify(conditions),
      JSON.stringify(actions),
      JSON.stringify(metadata),
      ruleId,
      worldId
    ]
  );
  return result.rows[0] ?? null;
}

export async function deleteRule(client, { worldId, ruleId }) {
  const result = await client.query(
    `DELETE FROM automation_rules WHERE id = $1 AND world_id = $2 RETURNING id`,
    [ruleId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function listWorldRules(worldId) {
  const result = await query(
    `SELECT rule.*, room.name AS room_name
     FROM automation_rules rule
     LEFT JOIN rooms room ON room.id = rule.room_id AND room.world_id = rule.world_id
     WHERE rule.world_id = $1
     ORDER BY rule.priority, rule.created_at`,
    [worldId]
  );
  return result.rows;
}
