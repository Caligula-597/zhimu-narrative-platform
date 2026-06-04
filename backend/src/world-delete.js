/**
 * Delete a world and all runtime data (parallel rooms first — rooms FK was RESTRICT before migration 017).
 */
export async function deleteOwnedWorld(client, worldId, ownerUserId) {
  const owned = await client.query(
    `SELECT id FROM worlds WHERE id = $1 AND owner_user_id = $2`,
    [worldId, ownerUserId]
  );
  if (!owned.rowCount) return false;

  await client.query(`DELETE FROM rooms WHERE world_id = $1`, [worldId]);
  const left = await client.query(`SELECT COUNT(*)::int AS n FROM rooms WHERE world_id = $1`, [worldId]);
  if (left.rows[0].n > 0) {
    const err = new Error("Rooms still reference this world after delete attempt");
    err.code = "WORLD_DELETE_BLOCKED";
    throw err;
  }

  await client.query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  return true;
}
