/**
 * Player portal public lobby — live parallel rooms open to strangers.
 * Separate from worlds.catalog_public (curated script library).
 */
import { query } from "./db.js";
import { worldCoverApiPath } from "./world-cover.js";

export async function listPublicRooms({ limit = 24 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 48);
  const result = await query(
    `SELECT r.id AS room_id,
            r.name AS room_name,
            r.invite_code,
            r.status AS room_status,
            r.updated_at,
            w.id AS world_id,
            w.name AS world_name,
            w.summary AS world_summary,
            COALESCE((
              SELECT profile.display_name FROM user_portal_profiles profile
              WHERE profile.user_id = u.id AND profile.portal = 'host'
            ), u.display_name) AS host_display_name,
            (SELECT COUNT(*)::int FROM role_slots rs WHERE rs.world_id = w.id) AS role_count,
            (SELECT COUNT(*)::int
             FROM room_members rm
             WHERE rm.room_id = r.id
               AND rm.role_slot_id IS NOT NULL
               AND rm.status = 'active') AS joined_players,
            EXISTS (
              SELECT 1
              FROM asset_files af
              WHERE af.world_id = w.id
                AND af.status = 'active'
                AND af.asset_kind = 'image'
                AND af.deleted_at IS NULL
            ) AS has_cover
     FROM rooms r
     JOIN worlds w ON w.id = r.world_id
     JOIN users u ON u.id = r.host_user_id
     WHERE r.public_listing = true
       AND w.status <> 'archived'
       AND r.status <> 'completed'
       AND EXISTS (SELECT 1 FROM role_slots rs WHERE rs.world_id = w.id)
     ORDER BY r.updated_at DESC
     LIMIT $1`,
    [safeLimit]
  );

  const items = result.rows.map((row) => ({
    roomId: row.room_id,
    roomName: row.room_name,
    inviteCode: row.invite_code,
    roomStatus: row.room_status,
    updatedAt: row.updated_at,
    worldId: row.world_id,
    worldName: row.world_name,
    worldSummary: row.world_summary,
    worldCoverUrl: row.has_cover ? worldCoverApiPath(row.world_id) : null,
    hostDisplayName: row.host_display_name,
    roleCount: row.role_count,
    joinedPlayers: row.joined_players,
    openSeats: Math.max(row.role_count - row.joined_players, 0)
  }));

  return {
    total: result.rowCount,
    items
  };
}
