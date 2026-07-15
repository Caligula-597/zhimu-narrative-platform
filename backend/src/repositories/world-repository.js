import { query } from "../db.js";

export async function listVisibleWorlds(actorId, includeArchived) {
  const result = await query(
    `SELECT DISTINCT ON (id) id, name, summary, status, catalog_public, catalog_review_status, catalog_review_submitted_at, catalog_review_note, membership_role, updated_at
     FROM (
       SELECT w.id, w.name, w.summary, w.status, w.catalog_public, w.catalog_review_status, w.catalog_review_submitted_at, w.catalog_review_note, wm.role::text AS membership_role, w.updated_at,
              CASE wm.role WHEN 'owner' THEN 4 WHEN 'editor' THEN 3 WHEN 'host' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END AS role_rank
       FROM worlds w
       JOIN world_members wm ON wm.world_id = w.id
       WHERE wm.user_id = $1 AND ($2::boolean OR w.status <> 'archived')
       UNION ALL
       SELECT w.id, w.name, w.summary, w.status, w.catalog_public, w.catalog_review_status, w.catalog_review_submitted_at, w.catalog_review_note, 'player' AS membership_role, w.updated_at, 0 AS role_rank
       FROM worlds w
       JOIN rooms r ON r.world_id = w.id
       JOIN room_members rm ON rm.room_id = r.id
       WHERE rm.user_id = $1 AND rm.status = 'active' AND ($2::boolean OR w.status <> 'archived')
     ) visible_worlds
     ORDER BY id, role_rank DESC, updated_at DESC`,
    [actorId, includeArchived]
  );
  return result.rows;
}

export async function listPublicCatalogWorlds({ tagSql = "", tagParams = [] } = {}) {
  const whereTags = tagSql ? ` AND ${tagSql}` : "";
  const result = await query(
    `SELECT w.id, w.name, w.summary, w.status, w.catalog_public, w.updated_at,
            u.display_name AS owner_display_name,
            (SELECT COUNT(*)::int FROM role_slots rs WHERE rs.world_id = w.id) AS role_count
     FROM worlds w
     JOIN users u ON u.id = w.owner_user_id
     WHERE w.catalog_public = true
       AND w.status <> 'archived'
       AND EXISTS (SELECT 1 FROM role_slots rs WHERE rs.world_id = w.id)${whereTags}
     ORDER BY w.updated_at DESC`,
    tagParams
  );
  return result.rows;
}

export async function findWorldForMember(worldId, actorId) {
  const result = await query(
    `SELECT w.id, w.name, w.summary, w.status, w.catalog_public, w.catalog_review_status, w.catalog_review_submitted_at, w.catalog_review_note, w.settings, w.created_at, w.updated_at, w.content_revision,
            wm.role AS membership_role
     FROM worlds w
     JOIN world_members wm ON wm.world_id = w.id AND wm.user_id = $2
     WHERE w.id = $1`,
    [worldId, actorId]
  );
  return result.rows[0] || null;
}

export async function findWorldOwnerId(worldId) {
  const result = await query(`SELECT owner_user_id FROM worlds WHERE id = $1`, [worldId]);
  return result.rows[0]?.owner_user_id || null;
}

export async function unpublishWorldCatalog(worldId) {
  const result = await query(
    `UPDATE worlds SET catalog_public = false, catalog_review_status = 'none', updated_at = now()
     WHERE id = $1
     RETURNING id, name, summary, status, catalog_public, catalog_review_status, created_at, updated_at`,
    [worldId]
  );
  return result.rows[0] || null;
}

export async function listWorldMembers(worldId) {
  const result = await query(
    `SELECT wm.user_id, u.email, u.display_name, wm.role, wm.created_at
     FROM world_members wm JOIN users u ON u.id = wm.user_id
     WHERE wm.world_id = $1 ORDER BY wm.created_at`,
    [worldId]
  );
  return result.rows;
}

export async function updateWorldMemberRole(worldId, userId, role) {
  const result = await query(
    `UPDATE world_members SET role = $1 WHERE world_id = $2 AND user_id = $3 AND role <> 'owner' RETURNING user_id, role`,
    [role, worldId, userId]
  );
  return result.rows[0] || null;
}

export async function removeWorldMember(worldId, userId) {
  const result = await query(
    `DELETE FROM world_members WHERE world_id = $1 AND user_id = $2 AND role <> 'owner' RETURNING user_id`,
    [worldId, userId]
  );
  return result.rows[0] || null;
}

export async function listWorldTimelineLogs(worldId, { roomId = null, eventType = "", keyword = "", limit = 80 } = {}) {
  const result = await query(
    `SELECT tl.id, tl.room_id, r.name AS room_name, tl.event_type, tl.message, tl.visibility,
            tl.metadata, tl.created_at, u.display_name AS actor_name
     FROM timeline_logs tl JOIN rooms r ON r.id = tl.room_id
     LEFT JOIN users u ON u.id = tl.actor_user_id
     WHERE r.world_id = $1 AND ($2::uuid IS NULL OR tl.room_id = $2::uuid)
       AND ($3 = '' OR tl.event_type = $3) AND ($4 = '' OR tl.message ILIKE '%' || $4 || '%')
     ORDER BY tl.created_at DESC LIMIT $5`,
    [worldId, roomId, eventType, keyword, limit]
  );
  return result.rows;
}
