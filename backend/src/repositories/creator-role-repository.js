const ROLE_FIELDS = `
  id, world_id, name, public_profile, private_profile,
  faction_key, sequence, settings, created_at`;

export async function insertCreatorRole(client, {
  worldId,
  name,
  publicProfile,
  privateProfile,
  sequence
}) {
  const result = await client.query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${ROLE_FIELDS}`,
    [worldId, name, publicProfile, privateProfile, sequence]
  );
  return result.rows[0];
}

export async function lockCreatorRole(client, { worldId, roleSlotId }) {
  const result = await client.query(
    `SELECT role_slot.*,
            (SELECT COUNT(*)::int FROM role_slots sibling
             WHERE sibling.world_id = role_slot.world_id) AS world_role_count,
            EXISTS (
              SELECT 1 FROM room_members room_member
              WHERE room_member.role_slot_id = role_slot.id
                AND room_member.status = 'active'
            ) AS has_active_members
     FROM role_slots role_slot
     WHERE role_slot.id = $1 AND role_slot.world_id = $2
     FOR UPDATE OF role_slot`,
    [roleSlotId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function updateCreatorRole(client, {
  roleSlotId,
  name,
  publicProfile,
  privateProfile,
  sequence
}) {
  const result = await client.query(
    `UPDATE role_slots
     SET name = $2,
         public_profile = $3,
         private_profile = $4,
         sequence = $5
     WHERE id = $1
     RETURNING ${ROLE_FIELDS}`,
    [roleSlotId, name, publicProfile, privateProfile, sequence]
  );
  return result.rows[0];
}

export async function deleteCreatorRole(client, roleSlotId) {
  const result = await client.query(
    `DELETE FROM role_slots WHERE id = $1 RETURNING id`,
    [roleSlotId]
  );
  return result.rowCount > 0;
}
