import { query, transaction } from "../db.js";
import { transactionWithEvents } from "../transaction-events.js";
import { requireActor } from "../request-actor.js";
import { sendErr } from "../api-errors.js";
import { hostLogSchema, hostNudgeWaitingSchema } from "./schemas.js";
import { eventRelatedRoleIds, extractTriggerPlayers } from "./host-helpers.js";
import { logHostAction } from "../audit-log.js";
import { assertRoleInRoomWorld, requireHostMembership } from "./host-route-guards.js";

export async function registerHostCommunicationRoutes(app) {
  app.post("/api/rooms/:roomId/host/log", { schema: hostLogSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { message, eventType, roleSlotId } = request.body ?? {};
    if (!message?.trim()) return sendErr(reply, "BAD_REQUEST", "message is required");
    await requireHostMembership(actorId, roomId);
    if (roleSlotId) {
      await transaction(async (client) => assertRoleInRoomWorld(client, roomId, roleSlotId));
    }
    await query(
      `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
       VALUES ($1, $2, 'host', $3, $4, jsonb_build_object('roleSlotId', $5::text, 'source', 'host_manual'))`,
      [roomId, actorId, eventType || "host_note", message.trim(), roleSlotId ?? null]
    );
    return { ok: true };
  });

  app.post("/api/rooms/:roomId/host/nudge-waiting", { schema: hostNudgeWaitingSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { message, roleSlotIds } = request.body ?? {};
    await requireHostMembership(actorId, roomId);

    const text = message?.trim()
      || "主持人正在处理待确认事件，请稍等；确认后新内容会自动解锁。";

    let targets = roleSlotIds?.length ? [...new Set(roleSlotIds)] : [];
    if (!targets.length) {
      const pending = await query(
        `SELECT phe.actions, ar.conditions AS rule_conditions
         FROM pending_host_events phe
         LEFT JOIN automation_rules ar ON ar.id = phe.rule_id
         WHERE phe.room_id = $1 AND phe.status = 'pending'`,
        [roomId]
      );
      const idSet = new Set();
      for (const row of pending.rows) {
        eventRelatedRoleIds({
          trigger_players: extractTriggerPlayers(row.rule_conditions),
          actions: row.actions
        }).forEach((id) => idSet.add(id));
      }
      if (idSet.size) {
        targets = [...idSet];
      } else {
        const joined = await query(
          `SELECT rm.role_slot_id
           FROM room_members rm
           WHERE rm.room_id = $1 AND rm.status = 'active' AND rm.role_slot_id IS NOT NULL`,
          [roomId]
        );
        targets = joined.rows.map((row) => row.role_slot_id);
      }
    }

    if (!targets.length) {
      return sendErr(reply, "NO_PLAYERS_TO_NUDGE", "当前没有可提醒的已入房玩家。");
    }

    await transactionWithEvents(async (client, queueEvent) => {
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'host_nudge', $3, $4::jsonb)`,
        [roomId, actorId, text, JSON.stringify({ roleSlotIds: targets })]
      );
      queueEvent(roomId, "room.host_nudge", { message: text, roleSlotIds: targets });
    });

    await logHostAction({
      roomId,
      actorUserId: actorId,
      action: "host_nudge_waiting",
      targetType: "room",
      targetId: roomId,
      metadata: { roleSlotIds: targets, message: text }
    });

    return { ok: true, notifiedCount: targets.length, roleSlotIds: targets };
  });
}
