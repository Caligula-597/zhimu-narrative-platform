/**
 * Join a world listed in the public catalog — creates or reuses personal runtime room.
 * World membership stays at viewer (play experience); never elevates to world host/editor.
 */
import { query, transaction } from "./db.js";
import { throwErr } from "./api-errors.js";
import { generateRoomInviteCode } from "./room-invite-code.js";

const PLAY_MEMBERSHIP_ROLE = "viewer";

export async function joinPublicCatalogWorld(actorId, worldId) {
  const world = await query(
    `SELECT id, name, catalog_public, status FROM worlds WHERE id = $1`,
    [worldId]
  );
  if (!world.rowCount) throwErr("WORLD_NOT_FOUND");
  if (!world.rows[0].catalog_public || world.rows[0].status === "archived") {
    throwErr("CATALOG_NOT_PUBLIC");
  }

  const user = await query(`SELECT display_name FROM users WHERE id = $1`, [actorId]);
  const displayName = user.rows[0]?.display_name || "玩家";

  const session = await transaction(async (client) => {
    const membership = await client.query(
      `SELECT role FROM world_members WHERE world_id = $1 AND user_id = $2`,
      [worldId, actorId]
    );
    let membershipRole = membership.rows[0]?.role;
    if (!membershipRole) {
      await client.query(
        `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, $3)`,
        [worldId, actorId, PLAY_MEMBERSHIP_ROLE]
      );
      membershipRole = PLAY_MEMBERSHIP_ROLE;
    }
    // Preserve existing collaborator roles — never promote viewer → host.

    const existingRoom = await client.query(
      `SELECT id, name, invite_code FROM rooms
       WHERE world_id = $1 AND host_user_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [worldId, actorId]
    );

    let room;
    if (existingRoom.rowCount) {
      room = existingRoom.rows[0];
      await client.query(`UPDATE rooms SET updated_at = now() WHERE id = $1`, [room.id]);
    } else {
      const roomName = `我的运行房 · ${displayName}`.slice(0, 120);
      const roomResult = await client.query(
        `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
         VALUES ($1, $2, $3, $4, 'testing') RETURNING id, name, invite_code`,
        [worldId, actorId, roomName, generateRoomInviteCode("PLAY")]
      );
      room = roomResult.rows[0];
    }

    await client.query(
      `INSERT INTO room_members (room_id, user_id, member_type) VALUES ($1, $2, 'host')
       ON CONFLICT (room_id, user_id) DO UPDATE SET status = 'active', member_type = 'host'`,
      [room.id, actorId]
    );
    const voiceExisting = await client.query(
      `SELECT 1 FROM voice_rooms WHERE room_id = $1 AND room_type = 'public' LIMIT 1`,
      [room.id]
    );
    if (!voiceExisting.rowCount) {
      await client.query(
        `INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
         VALUES ($1, '公共讨论房', 'public', $2)`,
        [room.id, actorId]
      );
    }

    return { membershipRole, room };
  });

  return {
    worldId,
    worldName: world.rows[0].name,
    membershipRole: session.membershipRole,
    room: session.room
  };
}
