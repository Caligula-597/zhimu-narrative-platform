import { query } from "../db.js";

export async function listWorldRoleRelationships(worldId) {
  const result = await query(
    `SELECT relationship.*,
            from_role.name AS from_role_name,
            to_role.name AS to_role_name
     FROM world_role_relationships relationship
     JOIN role_slots from_role ON from_role.id = relationship.from_role_slot_id
     JOIN role_slots to_role ON to_role.id = relationship.to_role_slot_id
     WHERE relationship.world_id = $1
     ORDER BY from_role.sequence, to_role.sequence, relationship.relation_type`,
    [worldId]
  );
  return result.rows;
}

export async function lockWorldRoleIds(client, { worldId, roleSlotIds }) {
  const result = await client.query(
    `SELECT role_slot.id
     FROM role_slots role_slot
     WHERE role_slot.world_id = $1 AND role_slot.id = ANY($2::uuid[])
     ORDER BY role_slot.id
     FOR KEY SHARE`,
    [worldId, roleSlotIds]
  );
  return result.rows.map((row) => row.id);
}

export async function upsertRoleRelationship(client, { worldId, body }) {
  const values = [
    worldId,
    body.fromRoleSlotId,
    body.toRoleSlotId,
    body.relationType ?? "relationship",
    body.label ?? "",
    body.strength ?? null,
    body.visibility ?? "host",
    JSON.stringify(body.metadata ?? {})
  ];
  const result = await client.query(
    `INSERT INTO world_role_relationships
       (world_id, from_role_slot_id, to_role_slot_id, relation_type,
        label, strength, visibility, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (world_id, from_role_slot_id, to_role_slot_id, relation_type)
     DO UPDATE SET label = EXCLUDED.label,
                   strength = EXCLUDED.strength,
                   visibility = EXCLUDED.visibility,
                   metadata = EXCLUDED.metadata,
                   updated_at = now()
     WHERE (world_role_relationships.label,
            world_role_relationships.strength,
            world_role_relationships.visibility,
            world_role_relationships.metadata)
       IS DISTINCT FROM
           (EXCLUDED.label, EXCLUDED.strength, EXCLUDED.visibility, EXCLUDED.metadata)
     RETURNING *`,
    values
  );
  if (result.rowCount) {
    return { relationship: result.rows[0], changed: true };
  }
  const existing = await client.query(
    `SELECT *
     FROM world_role_relationships
     WHERE world_id = $1
       AND from_role_slot_id = $2
       AND to_role_slot_id = $3
       AND relation_type = $4`,
    values.slice(0, 4)
  );
  return { relationship: existing.rows[0], changed: false };
}

export async function deleteRoleRelationship(client, { worldId, relationshipId }) {
  const result = await client.query(
    `DELETE FROM world_role_relationships
     WHERE id = $1 AND world_id = $2
     RETURNING id`,
    [relationshipId, worldId]
  );
  return result.rowCount > 0;
}

export async function upsertRoomRoleState(client, {
  roomId,
  roleSlotId,
  actorId,
  body
}) {
  const result = await client.query(
    `INSERT INTO room_role_states
       (room_id, role_slot_id, faction_key, public_alias, hidden_identity,
        variables, updated_by_user_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, now())
     ON CONFLICT (room_id, role_slot_id)
     DO UPDATE SET faction_key = COALESCE(EXCLUDED.faction_key, room_role_states.faction_key),
                   public_alias = COALESCE(EXCLUDED.public_alias, room_role_states.public_alias),
                   hidden_identity = COALESCE(EXCLUDED.hidden_identity, room_role_states.hidden_identity),
                   variables = room_role_states.variables || EXCLUDED.variables,
                   updated_by_user_id = EXCLUDED.updated_by_user_id,
                   updated_at = now()
     RETURNING *`,
    [
      roomId,
      roleSlotId,
      body.factionKey ?? null,
      body.publicAlias ?? null,
      body.hiddenIdentity ?? null,
      JSON.stringify(body.variables ?? {}),
      actorId
    ]
  );
  return result.rows[0];
}

export function appendRoleStateAudit(client, {
  roomId,
  actorId,
  roleSlotId,
  factionKey
}) {
  return client.query(
    `INSERT INTO host_audit_log
       (room_id, actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, 'role_state_updated', 'role_slot', $3, $4::jsonb)`,
    [roomId, actorId, roleSlotId, JSON.stringify({ factionKey: factionKey ?? null })]
  );
}
