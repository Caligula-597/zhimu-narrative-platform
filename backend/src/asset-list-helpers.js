export const ASSET_KINDS = ["image", "audio", "video", "document", "archive"];
export const ASSET_VISIBILITIES = ["author", "host", "role", "public"];

export function parseAssetListQuery(query = {}) {
  const kind = query.kind?.trim() || null;
  const q = query.q?.trim() || null;
  const visibility = query.visibility?.trim() || null;
  const recycled = query.recycled === "1" || query.recycled === "true";
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 200);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const envelope =
    recycled ||
    kind != null ||
    q != null ||
    visibility != null ||
    query.limit != null ||
    query.offset != null;

  return { kind, q, visibility, recycled, limit, offset, envelope };
}

export function buildAssetListQuery(worldId, filters, { actorId = null } = {}) {
  if (filters.recycled) {
    const conditions = ["af.world_id = $1", "af.status = 'deleted'", "da.purge_after > now()"];
    const params = [worldId];
    let paramIndex = 2;
    if (actorId) {
      conditions.push(`af.owner_user_id = $${paramIndex++}`);
      params.push(actorId);
    }
    if (filters.kind) {
      conditions.push(`af.asset_kind = $${paramIndex++}`);
      params.push(filters.kind);
    }
    if (filters.q) {
      conditions.push(`af.original_filename ILIKE $${paramIndex++}`);
      params.push(`%${filters.q}%`);
    }
    const where = conditions.join(" AND ");
    const listSql = `SELECT af.id, af.asset_kind, af.original_filename, af.content_type, af.byte_size, af.visibility, af.status,
                            af.created_at, af.deleted_at, da.purge_after
       FROM asset_files af
       JOIN deleted_assets da ON da.asset_file_id = af.id
       WHERE ${where}
       ORDER BY af.deleted_at DESC NULLS LAST
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const countSql = `SELECT COUNT(*)::int AS total
       FROM asset_files af
       JOIN deleted_assets da ON da.asset_file_id = af.id
       WHERE ${where}`;
    return {
      listSql,
      countSql,
      params: [...params, filters.limit, filters.offset],
      countParams: params
    };
  }

  const conditions = ["world_id = $1", "status = 'active'"];
  const params = [worldId];
  let paramIndex = 2;

  if (filters.kind) {
    conditions.push(`asset_kind = $${paramIndex++}`);
    params.push(filters.kind);
  }
  if (filters.visibility) {
    conditions.push(`visibility = $${paramIndex++}`);
    params.push(filters.visibility);
  }
  if (filters.q) {
    conditions.push(`original_filename ILIKE $${paramIndex++}`);
    params.push(`%${filters.q}%`);
  }

  const where = conditions.join(" AND ");
  const listSql = `SELECT id, asset_kind, original_filename, content_type, byte_size, visibility, status, created_at
     FROM asset_files
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  const countSql = `SELECT COUNT(*)::int AS total FROM asset_files WHERE ${where}`;

  return {
    listSql,
    countSql,
    params: [...params, filters.limit, filters.offset],
    countParams: params
  };
}
