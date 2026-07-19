import { query } from "../db.js";

function toPage(rows, { limit, offset }) {
  const hasMore = rows.length > limit;
  return {
    actions: hasMore ? rows.slice(0, limit) : rows,
    pagination: { limit, offset, hasMore }
  };
}

export async function listPrivateActionsForRole(roomId, roleSlotId, { limit = 100, offset = 0 } = {}) {
  const result = await query(
    `SELECT *
     FROM room_private_actions
     WHERE room_id = $1 AND (
       actor_role_slot_id = $2
       OR (visibility = 'actor_target_host' AND target_role_slot_id = $2)
     )
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [roomId, roleSlotId, limit + 1, offset]
  );
  return toPage(result.rows, { limit, offset });
}

export async function listPrivateActionsForHost(roomId, { limit = 100, offset = 0 } = {}) {
  const result = await query(
    `SELECT private_action.*,
            actor_role.name AS actor_role_name,
            target_role.name AS target_role_name
     FROM room_private_actions private_action
     JOIN role_slots actor_role ON actor_role.id = private_action.actor_role_slot_id
     LEFT JOIN role_slots target_role ON target_role.id = private_action.target_role_slot_id
     WHERE private_action.room_id = $1
     ORDER BY private_action.created_at DESC
     LIMIT $2 OFFSET $3`,
    [roomId, limit + 1, offset]
  );
  return toPage(result.rows, { limit, offset });
}

export async function lockPrivateActionReferences(client, {
  roomId,
  segmentId,
  targetRoleSlotId
}) {
  const result = await client.query(
    `SELECT
       (SELECT role_slot.id
        FROM role_slots role_slot
        JOIN rooms room ON room.world_id = role_slot.world_id
        WHERE room.id = $1 AND role_slot.id = $2
        FOR KEY SHARE OF role_slot) AS target_role_slot_id,
       (SELECT segment.id
        FROM world_segments segment
        JOIN rooms room ON room.world_id = segment.world_id
        WHERE room.id = $1 AND segment.id = $3
        FOR KEY SHARE OF segment) AS segment_id`,
    [roomId, targetRoleSlotId ?? null, segmentId ?? null]
  );
  return result.rows[0];
}

export async function createPrivateAction(client, {
  roomId,
  actorId,
  actorRoleSlotId,
  body
}) {
  const result = await client.query(
    `INSERT INTO room_private_actions
       (room_id, segment_id, actor_role_slot_id, target_role_slot_id, action_type,
        title, body, payload, visibility, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
     RETURNING *`,
    [
      roomId,
      body.segmentId ?? null,
      actorRoleSlotId,
      body.targetRoleSlotId ?? null,
      body.actionType,
      body.title,
      body.body ?? "",
      JSON.stringify(body.payload ?? {}),
      body.visibility ?? "actor_host",
      actorId
    ]
  );
  return result.rows[0];
}

export async function lockPrivateAction(client, { roomId, actionId }) {
  const result = await client.query(
    `SELECT *
     FROM room_private_actions
     WHERE id = $1 AND room_id = $2
     FOR UPDATE`,
    [actionId, roomId]
  );
  return result.rows[0] ?? null;
}

export async function updatePrivateAction(client, {
  roomId,
  actionId,
  actorId,
  status,
  hostResponse
}) {
  const result = await client.query(
    `UPDATE room_private_actions
     SET status = $3,
         host_response = COALESCE($4, host_response),
         resolved_by_user_id = CASE
           WHEN $3 IN ('accepted', 'rejected', 'resolved', 'cancelled') THEN $5
           ELSE resolved_by_user_id
         END,
         resolved_at = CASE
           WHEN $3 IN ('accepted', 'rejected', 'resolved', 'cancelled') THEN COALESCE(resolved_at, now())
           ELSE resolved_at
         END,
         updated_at = now()
     WHERE id = $1 AND room_id = $2
     RETURNING *`,
    [actionId, roomId, status, hostResponse ?? null, actorId]
  );
  return result.rows[0] ?? null;
}

export function appendPrivateActionTimeline(client, {
  roomId,
  actorId,
  eventType,
  message,
  metadata
}) {
  return client.query(
    `INSERT INTO timeline_logs
       (room_id, actor_user_id, visibility, event_type, message, metadata)
     VALUES ($1, $2, 'host', $3, $4, $5::jsonb)`,
    [roomId, actorId, eventType, message, JSON.stringify(metadata ?? {})]
  );
}
