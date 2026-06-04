export const ASSET_KINDS = ["image", "audio", "video", "document", "archive"];
export const ASSET_VISIBILITIES = ["author", "host", "role", "public"];

export function parseAssetListQuery(query = {}) {
  const kind = query.kind?.trim() || null;
  const q = query.q?.trim() || null;
  const visibility = query.visibility?.trim() || null;
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 200);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const envelope =
    kind != null ||
    q != null ||
    visibility != null ||
    query.limit != null ||
    query.offset != null;

  return { kind, q, visibility, limit, offset, envelope };
}

export function buildAssetListQuery(worldId, filters) {
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
