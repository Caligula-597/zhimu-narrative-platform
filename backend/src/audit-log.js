import { query } from "./db.js";

export async function logHostAction(
  { roomId, actorUserId, action, targetType = null, targetId = null, metadata = {} },
  client = null
) {
  const run = client?.query ? client.query.bind(client) : query;
  await run(
    `INSERT INTO host_audit_log (room_id, actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [roomId, actorUserId, action, targetType, targetId, JSON.stringify(metadata)]
  );
}

export async function listHostAuditLog(roomId, { limit = 50 } = {}) {
  const result = await query(
    `SELECT hal.id, hal.action, hal.target_type, hal.target_id, hal.metadata, hal.created_at,
            COALESCE((
              SELECT profile.display_name FROM user_portal_profiles profile
              WHERE profile.user_id = u.id AND profile.portal = 'host'
            ), u.display_name) AS actor_name
     FROM host_audit_log hal
     LEFT JOIN users u ON u.id = hal.actor_user_id
     WHERE hal.room_id = $1
     ORDER BY hal.created_at DESC
     LIMIT $2`,
    [roomId, limit]
  );
  return result.rows;
}

export async function listWorldHostAuditLog(worldId, { limit = 50 } = {}) {
  const result = await query(
    `SELECT hal.id, hal.room_id, hal.action, hal.target_type, hal.target_id, hal.metadata, hal.created_at,
            COALESCE((
              SELECT profile.display_name FROM user_portal_profiles profile
              WHERE profile.user_id = u.id AND profile.portal = 'host'
            ), u.display_name) AS actor_name, r.name AS room_name
     FROM host_audit_log hal
     JOIN rooms r ON r.id = hal.room_id
     LEFT JOIN users u ON u.id = hal.actor_user_id
     WHERE r.world_id = $1
     ORDER BY hal.created_at DESC
     LIMIT $2`,
    [worldId, limit]
  );
  return result.rows;
}

export async function listAuditLogOps({ limit = 50, offset = 0, roomId, action } = {}) {
  const params = [];
  const where = [];
  if (roomId) {
    params.push(roomId);
    where.push(`hal.room_id = $${params.length}`);
  }
  if (action) {
    params.push(action);
    where.push(`hal.action = $${params.length}`);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const [rows, countResult] = await Promise.all([
    query(
      `SELECT hal.id, hal.room_id, hal.action, hal.target_type, hal.target_id, hal.metadata,
              hal.created_at, hal.actor_user_id, COALESCE((
                SELECT profile.display_name FROM user_portal_profiles profile
                WHERE profile.user_id = u.id AND profile.portal = 'host'
              ), u.display_name) AS actor_name
       FROM host_audit_log hal
       LEFT JOIN users u ON u.id = hal.actor_user_id
       ${whereClause}
       ORDER BY hal.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM host_audit_log hal ${whereClause}`,
      params.slice(0, -2)
    )
  ]);

  return {
    items: rows.rows,
    limit,
    offset,
    total: countResult.rows[0]?.total ?? 0
  };
}
