import { query } from "../db.js";
import { transactionWithEvents } from "../transaction-events.js";
import { requireActor } from "../request-actor.js";
import { sendErr } from "../api-errors.js";
import {
  assertRoleInRoomWorld, requireHostMembership, requireRoomPlayer
} from "./content-platform-room-access.js";
import {
  createPrivateActionSchema, roomIdParams, updatePrivateActionSchema
} from "./schemas.js";

export async function registerContentPlatformPrivateActionRoutes(app) {
  app.get("/api/rooms/:roomId/private-actions", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomPlayer(actorId, roomId);
    const result = await query(
      `SELECT * FROM room_private_actions
       WHERE room_id = $1 AND (
         actor_role_slot_id = $2
         OR (visibility = 'actor_target_host' AND target_role_slot_id = $2)
       ) ORDER BY created_at DESC`,
      [roomId, membership.role_slot_id]
    );
    return { actions: result.rows };
  });

  app.post("/api/rooms/:roomId/private-actions", { schema: createPrivateActionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomPlayer(actorId, roomId);
    const body = request.body ?? {};
    await assertRoleInRoomWorld(roomId, body.targetRoleSlotId);
    let action;
    await transactionWithEvents(async (client, queueEvent) => {
      const result = await client.query(
        `INSERT INTO room_private_actions
          (room_id, segment_id, actor_role_slot_id, target_role_slot_id, action_type, title, body, payload, visibility, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10) RETURNING *`,
        [roomId, body.segmentId ?? null, membership.role_slot_id,
          body.targetRoleSlotId ?? null, body.actionType, body.title, body.body ?? "",
          JSON.stringify(body.payload ?? {}), body.visibility ?? "actor_host", actorId]
      );
      action = result.rows[0];
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'private_action_submitted', $3,
           jsonb_build_object('actionId', $4::text, 'actionType', $5::text, 'roleSlotId', $6::text))`,
        [roomId, actorId, `玩家提交了秘密行动：「${body.title}」`, action.id,
          body.actionType, membership.role_slot_id]
      );
      queueEvent(roomId, "room.private_action_submitted", {
        actionId: action.id, actionType: body.actionType
      });
    });
    return reply.code(201).send({ action });
  });

  app.get("/api/rooms/:roomId/host/private-actions", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const result = await query(
      `SELECT rpa.*, ars.name AS actor_role_name, trs.name AS target_role_name
       FROM room_private_actions rpa
       JOIN role_slots ars ON ars.id = rpa.actor_role_slot_id
       LEFT JOIN role_slots trs ON trs.id = rpa.target_role_slot_id
       WHERE rpa.room_id = $1 ORDER BY rpa.created_at DESC`,
      [roomId]
    );
    return { actions: result.rows };
  });

  app.patch("/api/rooms/:roomId/host/private-actions/:actionId", { schema: updatePrivateActionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, actionId } = request.params;
    const body = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    const result = await transactionWithEvents(async (client, queueEvent) => {
      const updated = await client.query(
        `UPDATE room_private_actions
         SET status = $3, host_response = COALESCE($4, host_response),
             resolved_by_user_id = CASE WHEN $3 IN ('accepted', 'rejected', 'resolved', 'cancelled') THEN $5 ELSE resolved_by_user_id END,
             resolved_at = CASE WHEN $3 IN ('accepted', 'rejected', 'resolved', 'cancelled') THEN COALESCE(resolved_at, now()) ELSE resolved_at END,
             updated_at = now()
         WHERE id = $1 AND room_id = $2 RETURNING *`,
        [actionId, roomId, body.status, body.hostResponse ?? null, actorId]
      );
      if (!updated.rowCount) return null;
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'private_action_status_updated', $3,
           jsonb_build_object('actionId', $4::text, 'status', $5::text))`,
        [roomId, actorId, `秘密行动状态更新为 ${body.status}`, actionId, body.status]
      );
      queueEvent(roomId, "room.private_action_updated", { actionId, status: body.status });
      return updated.rows[0];
    });
    if (!result) return sendErr(reply, "NOT_FOUND", "Private action not found");
    return { action: result };
  });
}
