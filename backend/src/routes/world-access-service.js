import { query } from "../db.js";
import { throwErr } from "../api-errors.js";
/** Rooms visible to actor: owners/editors see all; hosts/viewers only their own hosted or joined rooms. */
export const ROOMS_VISIBLE_TO_ACTOR_SQL = `(
  EXISTS (
    SELECT 1 FROM world_members wm
    WHERE wm.world_id = r.world_id AND wm.user_id = $2 AND wm.role IN ('owner', 'editor')
  )
  OR r.host_user_id = $2
  OR EXISTS (
    SELECT 1 FROM room_members rm
    WHERE rm.room_id = r.id AND rm.user_id = $2 AND rm.status = 'active'
  )
)`;

import { effectiveStorageLimits, countOwnedWorlds } from "../plans.js";

export async function storageUsage(userId) {
  const limits = await effectiveStorageLimits(userId);
  const usage = await query(
    `SELECT COALESCE(SUM(a.byte_size) FILTER (WHERE a.status IN ('pending_upload', 'active')), 0)::bigint AS used_bytes
     FROM asset_files a
     WHERE a.owner_user_id = $1`,
    [userId]
  );
  const used = Number(usage.rows[0]?.used_bytes ?? 0);
  const usedWorlds = await countOwnedWorlds(userId);
  await query(
    `INSERT INTO storage_quotas (user_id, max_bytes, max_worlds, max_single_file_bytes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = storage_quotas.updated_at`,
    [userId, limits.max_bytes, limits.max_worlds, limits.max_single_file_bytes]
  );
  return {
    max_bytes: limits.max_bytes,
    max_worlds: limits.max_worlds,
    max_single_file_bytes: limits.max_single_file_bytes,
    used_bytes: used,
    used_worlds: usedWorlds,
    plan_code: limits.planCode
  };
}

export async function requireAssetRead(actorId, assetId) {
  const result = await query(
    `SELECT a.*, rm.member_type, rm.role_slot_id AS member_role_slot_id
     FROM asset_files a
     LEFT JOIN room_members rm ON rm.room_id = a.room_id AND rm.user_id = $2 AND rm.status = 'active'
     LEFT JOIN world_members wm ON wm.world_id = a.world_id AND wm.user_id = $2
     WHERE a.id = $1 AND a.status = 'active'
       AND (
         a.owner_user_id = $2 OR wm.role IN ('owner', 'editor', 'host')
         OR a.visibility = 'public'
         OR (a.visibility = 'host' AND rm.member_type IN ('host', 'cohost'))
         OR (a.visibility = 'role' AND rm.role_slot_id = a.role_slot_id)
         OR (
           a.visibility = 'role'
           AND a.role_slot_id IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM room_members rm2
             JOIN rooms r2 ON r2.id = rm2.room_id
             WHERE rm2.user_id = $2
               AND rm2.status = 'active'
               AND rm2.role_slot_id = a.role_slot_id
               AND r2.world_id = a.world_id
           )
         )
       )`,
    [assetId, actorId]
  );
  if (!result.rowCount) throwErr("ASSET_NOT_FOUND");
  return result.rows[0];
}
