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

import { PLAN_DEFAULTS } from "../plans.js";

export const STORAGE_USAGE_SQL = `
  SELECT
    COALESCE((
      SELECT plan_code FROM user_plans WHERE user_id = $1
    ), 'free') AS plan_code,
    (SELECT max_bytes FROM storage_quotas WHERE user_id = $1) AS stored_max_bytes,
    (SELECT max_worlds FROM storage_quotas WHERE user_id = $1) AS stored_max_worlds,
    (SELECT max_single_file_bytes FROM storage_quotas WHERE user_id = $1) AS stored_max_single_file_bytes,
    COALESCE((
      SELECT SUM(byte_size) FILTER (WHERE status IN ('pending_upload', 'active'))
      FROM asset_files WHERE owner_user_id = $1
    ), 0)::bigint AS used_bytes,
    (SELECT COUNT(*)::int FROM worlds
      WHERE owner_user_id = $1 AND status <> 'archived') AS used_worlds`;

export async function storageUsage(userId, client = null) {
  const db = client?.query ? client.query.bind(client) : query;
  const result = await db(STORAGE_USAGE_SQL, [userId]);
  const row = result.rows[0] ?? {};
  const planCode = PLAN_DEFAULTS[row.plan_code] ? row.plan_code : "free";
  const defaults = PLAN_DEFAULTS[planCode];
  return {
    max_bytes: Math.max(defaults.max_bytes, Number(row.stored_max_bytes ?? 0)),
    max_worlds: Math.max(defaults.max_worlds, Number(row.stored_max_worlds ?? 0)),
    max_single_file_bytes: Math.max(
      defaults.max_single_file_bytes,
      Number(row.stored_max_single_file_bytes ?? 0)
    ),
    used_bytes: Number(row.used_bytes ?? 0),
    used_worlds: Number(row.used_worlds ?? 0),
    plan_code: planCode
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
         a.owner_user_id = $2 OR wm.role IN ('owner', 'editor', 'reviewer', 'host')
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
