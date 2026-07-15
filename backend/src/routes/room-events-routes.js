import { requireActor } from "../request-actor.js";
import { subscribeRoomEvents } from "../room-event-bus.js";
import { fetchJournalEventsAfter, getLatestRoomEventId } from "../room-event-journal.js";
import { createReplaySubscription } from "../sse-replay-subscription.js";
import { requireRoomRole } from "./route-guards.js";
import { roomIdParams } from "./schemas.js";
import { writeSseEvent } from "../sse-response.js";

export async function registerRoomEventsRoutes(app) {
  app.get("/api/rooms/:roomId/events/stream", { schema: { params: roomIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireRoomRole(actorId, roomId);

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
    const cleanup = (endResponse = false) => {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
      if (endResponse && !reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.end();
    };

    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);

    const subscription = createReplaySubscription({
      lastEventId: request.headers["last-event-id"],
      subscribe: (send) => subscribeRoomEvents(roomId, send),
      getLatestId: () => getLatestRoomEventId(roomId),
      fetchAfter: (afterId, options) => fetchJournalEventsAfter(roomId, afterId, options),
      send: (envelope) => writeSseEvent(reply.raw, envelope),
      beforeLive: () => writeSseEvent(reply.raw, {
        payload: JSON.stringify({ type: "connected", roomId, at: new Date().toISOString() })
      }),
      onClose: () => cleanup(true),
      onReplayError: (error) => request.log.warn({ err: error, roomId }, "room SSE replay failed")
    });
    unsubscribe = subscription.unsubscribe;
    const streamReady = await subscription.ready;
    if (!streamReady || closed) return;

    heartbeat = setInterval(() => {
      if (!writeSseEvent(reply.raw, {
        payload: JSON.stringify({ type: "heartbeat", roomId, at: new Date().toISOString() })
      })) cleanup();
    }, 25000);
    heartbeat.unref?.();
  });
}
