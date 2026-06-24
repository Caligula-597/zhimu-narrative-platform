export async function getRoleSlotLastOccupantUserId(client, roomId, roleSlotId) {
  const result = await client.query(
    `SELECT variables->>'lastOccupantUserId' AS last_user_id
     FROM player_states
     WHERE room_id = $1 AND role_slot_id = $2`,
    [roomId, roleSlotId]
  );
  return result.rows[0]?.last_user_id ?? null;
}

export async function recordRoleSlotLastOccupant(client, roomId, roleSlotId, userId) {
  await client.query(
    `INSERT INTO player_states (room_id, role_slot_id, variables, updated_at)
     VALUES ($1, $2, jsonb_build_object('lastOccupantUserId', $3::text), now())
     ON CONFLICT (room_id, role_slot_id)
     DO UPDATE SET variables = COALESCE(player_states.variables, '{}'::jsonb)
                       || jsonb_build_object('lastOccupantUserId', $3::text),
                   updated_at = now()`,
    [roomId, roleSlotId, userId]
  );
}

export async function clearRoleSlotRuntime(client, roomId, roleSlotId, { preserveHostNotes = true } = {}) {
  let hostNotes = "";
  if (preserveHostNotes) {
    const ps = await client.query(
      `SELECT variables->>'hostNotes' AS host_notes
       FROM player_states
       WHERE room_id = $1 AND role_slot_id = $2`,
      [roomId, roleSlotId]
    );
    hostNotes = ps.rows[0]?.host_notes ?? "";
  }

  await client.query(`DELETE FROM reading_progress WHERE room_id = $1 AND role_slot_id = $2`, [roomId, roleSlotId]);
  await client.query(`DELETE FROM inventory WHERE room_id = $1 AND role_slot_id = $2`, [roomId, roleSlotId]);
  await client.query(`DELETE FROM clue_ownership WHERE room_id = $1 AND role_slot_id = $2`, [roomId, roleSlotId]);
  await client.query(`DELETE FROM clue_read_receipts WHERE room_id = $1 AND role_slot_id = $2`, [roomId, roleSlotId]);
  await client.query(`DELETE FROM investigation_records WHERE room_id = $1 AND role_slot_id = $2`, [roomId, roleSlotId]);
  await client.query(`DELETE FROM notebook_entries WHERE room_id = $1 AND role_slot_id = $2`, [roomId, roleSlotId]);
  await client.query(`DELETE FROM player_states WHERE room_id = $1 AND role_slot_id = $2`, [roomId, roleSlotId]);

  if (preserveHostNotes && hostNotes) {
    await client.query(
      `INSERT INTO player_states (room_id, role_slot_id, variables, updated_at)
       VALUES ($1, $2, jsonb_build_object('hostNotes', $3::text), now())`,
      [roomId, roleSlotId, hostNotes]
    );
  }
}

/** Clear seat progress when a different account takes the role; no-op for same last occupant. */
export async function prepareRoleSlotForJoin(client, roomId, roleSlotId, actorId) {
  const lastUserId = await getRoleSlotLastOccupantUserId(client, roomId, roleSlotId);
  if (lastUserId && lastUserId !== actorId) {
    await clearRoleSlotRuntime(client, roomId, roleSlotId, { preserveHostNotes: true });
  }
  await recordRoleSlotLastOccupant(client, roomId, roleSlotId, actorId);
}
