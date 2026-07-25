import { requireActor } from "../request-actor.js";
import { sendErr } from "../api-errors.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import {
  batchHostEvents,
  delayHostEventById,
  dismissHostEventById,
  executeHostEventById
} from "./host-event-actions.js";
import { getPendingHostEvents } from "../host-event-service.js";
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
    return getPendingHostEvents(roomId);
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
      return { ok: true, delayMinutes: result.delayMinutes };
    });
  });
}
