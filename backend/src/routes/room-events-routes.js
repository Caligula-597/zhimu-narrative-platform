import { requireActor } from "../request-actor.js";
import { subscribeRoomEvents } from "../room-event-bus.js";
import { fetchJournalEventsAfter } from "../room-event-journal.js";
import { requireRoomRole } from "./route-guards.js";
import { roomIdParams } from "./schemas.js";

function writeSseEvent(raw, { id, payload }) {
  try {
    if (raw.destroyed || raw.writableEnded) return false;
    if (id !== undefined && id !== null) raw.write(`id: ${id}\n`);
    raw.write(`data: ${payload}\n\n`);
    return true;
  } catch {
    return false;
  }
}

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

    const lastEventId = request.headers["last-event-id"];
    if (lastEventId) {
      try {
        const replay = await fetchJournalEventsAfter(roomId, lastEventId);
        for (const row of replay) {
          if (!writeSseEvent(reply.raw, {
            id: row.id,
            payload: JSON.stringify(row.payload)
          })) break;
        }
      } catch {
        /* replay failure should not block live stream */
      }
    }

    writeSseEvent(reply.raw, {
      payload: JSON.stringify({ type: "connected", roomId, at: new Date().toISOString() })
    });

    let closed = false;
    let unsubscribe = () => {};
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
    };

    unsubscribe = subscribeRoomEvents(roomId, (message) => {
      const envelope = typeof message === "string" ? { payload: message } : message;
      if (!writeSseEvent(reply.raw, envelope)) cleanup();
    });
    const heartbeat = setInterval(() => {
      if (!writeSseEvent(reply.raw, {
        payload: JSON.stringify({ type: "heartbeat", roomId, at: new Date().toISOString() })
      })) cleanup();
    }, 25000);
    heartbeat.unref?.();

    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);
  });
}
