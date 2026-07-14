import { query } from "../db.js";
import { requireActor } from "../request-actor.js";
import { sendErr } from "../api-errors.js";
import { logHostAction } from "../audit-log.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import {
  batchHostEvents,
  delayHostEventById,
  dismissHostEventById,
  executeHostEventById
} from "./host-event-actions.js";
import { wakeDueDelayedHostEvents } from "../host-delay-wake.js";
import { eventSourceLabel, extractTriggerPlayers, summarizeHostAction } from "./host-helpers.js";
import { requireHostMembership } from "./host-route-guards.js";
import {
  hostEventBatchSchema,
  hostEventDelaySchema,
  hostEventSchema,
  roomIdParams
} from "./schemas.js";

export async function registerHostEventRoutes(app) {
  app.get("/api/rooms/:roomId/host-events", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    await wakeDueDelayedHostEvents();
    const result = await query(
      `SELECT phe.id, phe.event_key, phe.title, phe.description, phe.status, phe.created_at,
              phe.delay_until, phe.rule_id, phe.actions,
              ar.name AS rule_name, ar.conditions AS rule_conditions, ar.mode AS rule_mode
       FROM pending_host_events phe
       LEFT JOIN automation_rules ar ON ar.id = phe.rule_id
       WHERE phe.room_id = $1 AND phe.status IN ('pending', 'delayed')
       ORDER BY CASE WHEN phe.status = 'delayed' THEN 1 ELSE 0 END, phe.created_at`,
      [roomId]
    );
    return result.rows.map((event) => ({
      ...event,
      source_label: eventSourceLabel(event),
      action_summaries: (event.actions ?? []).map(summarizeHostAction),
      trigger_players: extractTriggerPlayers(event.rule_conditions)
    }));
  });

  app.post("/api/rooms/:roomId/host-events/batch", { schema: hostEventBatchSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const { action, eventIds } = request.body;
    return withRoomIdempotency(roomId, request, "host.event_batch", async () => {
      const result = await batchHostEvents(roomId, actorId, action, eventIds);
      if (!result.ok) return sendErr(reply, result.code, result.message);
      return result;
    });
  });

  app.post("/api/rooms/:roomId/host-events/:eventId/dismiss", { schema: hostEventSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, eventId } = request.params;
    await requireHostMembership(actorId, roomId);
    return withRoomIdempotency(roomId, request, "host.event_dismiss", async () => {
      const result = await dismissHostEventById(roomId, actorId, eventId);
      if (!result.ok) return sendErr(reply, result.code);
      return { ok: true };
    });
  });

  app.post("/api/rooms/:roomId/host-events/:eventId/execute", { schema: hostEventSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, eventId } = request.params;
    await requireHostMembership(actorId, roomId);
    return withRoomIdempotency(roomId, request, "host.event_execute", async () => {
      const result = await executeHostEventById(roomId, actorId, eventId);
      if (!result.ok) return sendErr(reply, result.code);
      return { ok: true };
    });
  });

  app.post("/api/rooms/:roomId/host-events/:eventId/delay", { schema: hostEventDelaySchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, eventId } = request.params;
    const { delayMinutes } = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    return withRoomIdempotency(roomId, request, "host.event_delay", async () => {
      const result = await delayHostEventById(roomId, actorId, eventId, delayMinutes);
      if (!result.ok) return sendErr(reply, result.code);
      await logHostAction({
        roomId,
        actorUserId: actorId,
        action: "host_event_delayed",
        targetType: "host_event",
        targetId: eventId,
        metadata: { delayMinutes: result.delayMinutes }
      });
      return { ok: true, delayMinutes: result.delayMinutes };
    });
  });
}
