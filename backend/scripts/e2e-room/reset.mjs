/**
 * Reset runtime state for the E2E parallel room only.
 * Does NOT touch FOG-HARBOR-DEMO or world authoring content.
 */
import { E2E } from "./constants.mjs";

export async function resetE2eRoomRuntime(client) {
  const roomId = E2E.roomId;

  const role = await client.query(
    `SELECT id FROM role_slots WHERE world_id = $1 ORDER BY sequence LIMIT 1`,
    [E2E.worldId]
  );
  const roleId = role.rows[0]?.id;

  const sections = roleId
    ? await client.query(
        `SELECT id FROM script_sections WHERE role_slot_id = $1 ORDER BY sequence`,
        [roleId]
      )
    : { rows: [] };
  const secondSectionId = sections.rows[1]?.id;

  const secretScene = await client.query(
    `SELECT id FROM scenes WHERE metadata->>'seedKey' = 'fog-secret-room' AND world_id = $1`,
    [E2E.worldId]
  );
  const secretSceneId = secretScene.rows[0]?.id;

  await client.query(`DELETE FROM reading_progress WHERE room_id = $1`, [roomId]);
  await client.query(`DELETE FROM notebook_entries WHERE room_id = $1`, [roomId]);

  if (secondSectionId) {
    await client.query(
      `DELETE FROM room_content_unlocks
       WHERE room_id = $1 AND content_type = 'script_section' AND content_id = $2`,
      [roomId, secondSectionId]
    );
  }

  await client.query(`DELETE FROM investigation_records WHERE room_id = $1`, [roomId]);
  await client.query(`DELETE FROM clue_ownership WHERE room_id = $1`, [roomId]);
  await client.query(`DELETE FROM clue_read_receipts WHERE room_id = $1`, [roomId]);
  await client.query(`DELETE FROM pending_host_events WHERE room_id = $1`, [roomId]);
  await client.query(`DELETE FROM rule_executions WHERE room_id = $1`, [roomId]);
  await client.query(`DELETE FROM checkpoints WHERE room_id = $1`, [roomId]);
  await client.query(`DELETE FROM room_recaps WHERE room_id = $1`, [roomId]);

  if (secretSceneId) {
    await client.query(
      `DELETE FROM room_content_unlocks
       WHERE room_id = $1 AND content_type = 'scene' AND content_id = $2`,
      [roomId, secretSceneId]
    );
  }

  if (roleId) {
    await client.query(`DELETE FROM player_states WHERE room_id = $1 AND role_slot_id = $2`, [roomId, roleId]);
    await client.query(
      `INSERT INTO player_states (room_id, role_slot_id) VALUES ($1, $2)
       ON CONFLICT (room_id, role_slot_id) DO NOTHING`,
      [roomId, roleId]
    );
  }

  // Remove player so Act 2 can exercise invite-code join every run.
  await client.query(
    `DELETE FROM room_members
     WHERE room_id = $1 AND user_id = $2 AND member_type = 'player'`,
    [roomId, E2E.playerUserId]
  );

  return { roomId, roleId, inviteCode: E2E.inviteCode };
}
