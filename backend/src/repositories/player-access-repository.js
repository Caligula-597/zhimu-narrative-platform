import { query } from "../db.js";

export async function findInviteAccess(inviteCode, actorId, executor = query) {
  const result = await executor(
    `SELECT r.id, r.name, r.status, r.world_id, w.name AS world_name,
            COALESCE(NULLIF(w.settings->'narrativeProfile'->>'creationType', ''), NULLIF(w.settings->>'creationType', ''), CASE WHEN w.settings->>'worldMode' = 'campaign' THEN 'tabletop_rpg' ELSE 'murder_mystery' END) AS creation_type,
            r.release_id, w.content_revision AS current_content_revision,
            release.release_number, release.label AS release_label,
            release.source_content_revision AS release_source_revision,
            release.created_at AS release_created_at,
            (SELECT rm.role_slot_id
             FROM room_members rm
             WHERE rm.room_id = r.id AND rm.user_id = $2
               AND rm.status = 'active' AND rm.role_slot_id IS NOT NULL
             LIMIT 1) AS current_role_slot_id,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', rs.id,
                'name', rs.name,
                'public_profile', rs.public_profile,
                'occupied', active.user_id IS NOT NULL,
                'occupied_by_current', COALESCE(active.user_id = $2, false)
              ) ORDER BY rs.sequence)
              FROM role_slots rs
              LEFT JOIN room_members active
                ON active.room_id = r.id
               AND active.role_slot_id = rs.id
               AND active.status = 'active'
              WHERE rs.world_id = r.world_id
            ), '[]'::jsonb) AS roles
     FROM rooms r
     JOIN worlds w ON w.id = r.world_id
     LEFT JOIN world_releases release ON release.id = r.release_id
     WHERE r.invite_code = $1`,
    [inviteCode, actorId]
  );
  return result.rows[0] ?? null;
}

/**
 * Board-game seats are authored in boardGameDesign rather than as narrative
 * character roles. Materialize matching role slots so the existing invite,
 * occupancy and room-member concurrency contract can safely be reused.
 */
export async function ensureBoardGameRoleSlots(client, { roomId, inviteCode } = {}) {
  const result = await client.query(
    `SELECT r.id AS room_id, r.world_id, w.settings
     FROM rooms r
     JOIN worlds w ON w.id = r.world_id
     WHERE ${roomId ? "r.id = $1" : "r.invite_code = $1"}
     FOR UPDATE OF r`,
    [roomId || inviteCode]
  );
  const room = result.rows[0];
  const profile = room?.settings?.narrativeProfile?.creationType || room?.settings?.creationType;
  const design = room?.settings?.boardGameDesign;
  if (!room || profile !== "board_game" || !design || typeof design !== "object") return 0;
  const seats = Array.isArray(design.seats) ? design.seats : [];
  if (!seats.length) return 0;
  const existingResult = await client.query(
    `SELECT id, sequence, settings->>'boardGameSeatId' AS board_game_seat_id
     FROM role_slots WHERE world_id = $1 FOR UPDATE`,
    [room.world_id]
  );
  const existingBySeat = new Map(existingResult.rows.map((row) => [String(row.board_game_seat_id || ""), row]));
  let created = 0;
  for (const [index, seat] of seats.entries()) {
    const seatId = String(seat?.id || `board-seat-${index + 1}`);
    if (existingBySeat.has(seatId)) continue;
    const sequence = Number(seat?.sequence) > 0 ? Number(seat.sequence) : index + 1;
    await client.query(
      `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence, settings)
       VALUES ($1, $2, $3, '', $4, $5::jsonb)
       ON CONFLICT (world_id, sequence) DO NOTHING`,
      [
        room.world_id,
        String(seat?.name || `玩家席位 ${index + 1}`).slice(0, 160),
        String(seat?.description || "桌游玩家席位").slice(0, 1000),
        sequence,
        JSON.stringify({ boardGameSeatId: seatId, boardGameSeat: true })
      ]
    );
    created += 1;
  }
  return created;
}

export async function configureJoinTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '10000ms', true)`
  );
}

export async function findJoinTarget(client, inviteCode, roleSlotId) {
  const result = await client.query(
    `SELECT r.id AS room_id, r.world_id,
            rs.id AS role_slot_id, rs.name AS role_name
     FROM rooms r
     LEFT JOIN role_slots rs
       ON rs.id = $2 AND rs.world_id = r.world_id
     WHERE r.invite_code = $1`,
    [inviteCode, roleSlotId]
  );
  return result.rows[0] ?? null;
}

export async function ensureJoinMembershipRow(client, roomId, actorId) {
  await client.query(
    `INSERT INTO room_members (room_id, user_id, member_type)
     VALUES ($1, $2, 'player')
     ON CONFLICT (room_id, user_id) DO NOTHING`,
    [roomId, actorId]
  );
}

export async function lockJoinMembership(client, roomId, actorId) {
  const result = await client.query(
    `SELECT role_slot_id, status
     FROM room_members
     WHERE room_id = $1 AND user_id = $2
     FOR UPDATE`,
    [roomId, actorId]
  );
  return result.rows[0] ?? null;
}

export async function lockActiveSeatOccupant(client, roomId, roleSlotId, actorId) {
  const result = await client.query(
    `SELECT user_id
     FROM room_members
     WHERE room_id = $1 AND role_slot_id = $2
       AND user_id <> $3 AND status = 'active'
     FOR UPDATE`,
    [roomId, roleSlotId, actorId]
  );
  return result.rows[0] ?? null;
}

export async function bindJoinMembership(client, roomId, actorId, roleSlotId) {
  await client.query(
    `UPDATE room_members
     SET role_slot_id = $3, status = 'active'
     WHERE room_id = $1 AND user_id = $2`,
    [roomId, actorId, roleSlotId]
  );
}
