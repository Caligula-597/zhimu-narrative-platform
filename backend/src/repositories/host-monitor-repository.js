export async function updateClueOwnershipHostNote(runQuery, {
  roomId,
  roleSlotId,
  clueId,
  hostNote
}) {
  const result = await runQuery(
    `UPDATE clue_ownership
     SET host_note = $4
     WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3
     RETURNING host_note`,
    [roomId, roleSlotId, clueId, hostNote]
  );
  return result.rows[0]?.host_note ?? null;
}
