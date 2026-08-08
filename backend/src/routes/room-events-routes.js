import { requireActor } from "../request-actor.js";
import { subscribeRoomEvents } from "../room-event-bus.js";
import { fetchJournalEventsAfter, getLatestRoomEventId } from "../room-event-journal.js";
import { createReplaySubscription } from "../sse-replay-subscription.js";
import { requireRoomRole } from "./route-guards.js";
import { roomIdParams } from "./schemas.js";
import { resolveSseMaxConnectionAgeMs, writeSseEvent } from "../sse-response.js";
import { acquireSseConnection } from "../sse-connection-guard.js";
import { projectRoomEventEnvelope } from "../room-event-audience.js";

export async function registerRoomEventsRoutes(app) {
  app.get("/api/rooms/:roomId/events/stream", { schema: { params: roomIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    const releaseConnection = acquireSseConnection(request, reply);

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    let closed = false;
    let unsubscribe = () => {};
    let heartbeat = null;
    let maxAgeTimer = null;
    const cleanup = (endResponse = false) => {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (maxAgeTimer) clearTimeout(maxAgeTimer);
      unsubscribe();
      releaseConnection();
      if (endResponse && !reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.end();
    };

    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);
    maxAgeTimer = setTimeout(() => cleanup(true), resolveSseMaxConnectionAgeMs());
    maxAgeTimer.unref?.();

    const subscription = createReplaySubscription({
      lastEventId: request.headers["last-event-id"],
      subscribe: (send) => subscribeRoomEvents(roomId, send),
      getLatestId: () => getLatestRoomEventId(roomId),
      fetchAfter: (afterId, options) => fetchJournalEventsAfter(roomId, afterId, options),
      send: (envelope) => {
        const projected = projectRoomEventEnvelope(envelope, {
          actorId,
          memberType: membership.member_type,
          roleSlotId: membership.role_slot_id
        });
        const written = writeSseEvent(reply.raw, projected.envelope);
        if (written && projected.disconnectAfter) queueMicrotask(() => cleanup(true));
        return written;
      },
      beforeLive: () => writeSseEvent(reply.raw, {
        payload: JSON.stringify({ type: "connected", roomId, at: new Date().toISOString() })
      }),
      onClose: () => cleanup(true),
      onReplayError: (error) => request.log.warn({ err: error, roomId }, "room SSE replay failed")
    });
    unsubscribe = subscription.unsubscribe;
    if (closed) {
      unsubscribe();
      return;
    }
    const streamReady = await subscription.ready;
    if (!streamReady || closed) return;

    heartbeat = setInterval(() => {
      if (!writeSseEvent(reply.raw, {
        payload: JSON.stringify({ type: "heartbeat", roomId, at: new Date().toISOString() })
      })) cleanup(true);
    }, 25000);
    heartbeat.unref?.();
  });
}
