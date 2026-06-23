/**
 * Join a world listed in the public catalog — creates or reuses personal runtime room.
 */
import { query, transaction } from "./db.js";
import { throwErr } from "./api-errors.js";

const ROLE_RANK = { viewer: 0, host: 1, editor: 2, owner: 3 };

function catalogInviteCode() {
  return `PLAY-${Date.now().toString(36).toUpperCase().slice(-8)}`;
}

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
        `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'host')`,
        [worldId, actorId]
      );
      membershipRole = "host";
    } else if (ROLE_RANK[membershipRole] < ROLE_RANK.host) {
      await client.query(
        `UPDATE world_members SET role = 'host' WHERE world_id = $1 AND user_id = $2`,
        [worldId, actorId]
      );
      membershipRole = "host";
    }

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
        [worldId, actorId, roomName, catalogInviteCode()]
      );
      room = roomResult.rows[0];
    }

    await client.query(
      `INSERT INTO room_members (room_id, user_id, member_type) VALUES ($1, $2, 'host')
       ON CONFLICT (room_id, user_id) DO UPDATE SET status = 'active', member_type = 'host'`,
      [room.id, actorId]
    );
    await client.query(
      `INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
       VALUES ($1, '公共讨论房', 'public', $2)`,
      [room.id, actorId]
    );

    return { membershipRole, room };
  });

  return {
    worldId,
    worldName: world.rows[0].name,
    membershipRole: session.membershipRole,
    room: session.room
  };
}
