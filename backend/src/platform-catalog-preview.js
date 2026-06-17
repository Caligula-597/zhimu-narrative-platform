/**
 * Public catalog preview for marketing site (no auth).
 */
import { query } from "./db.js";

export async function listPublicCatalogPreview({ limit = 8 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 24);
  const result = await query(
    `SELECT w.id, w.name, w.summary, w.updated_at,
            u.display_name AS owner_display_name,
            (SELECT COUNT(*)::int FROM role_slots rs WHERE rs.world_id = w.id) AS role_count
     FROM worlds w
     JOIN users u ON u.id = w.owner_user_id
     WHERE w.catalog_public = true
       AND w.status <> 'archived'
       AND EXISTS (SELECT 1 FROM role_slots rs WHERE rs.world_id = w.id)
     ORDER BY w.updated_at DESC
     LIMIT $1`,
    [safeLimit]
  );

  return {
    total: result.rowCount,
    items: result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      summary: row.summary,
      roleCount: row.role_count,
      ownerDisplayName: row.owner_display_name,
      updatedAt: row.updated_at
    }))
  };
}
