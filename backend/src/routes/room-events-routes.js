import { requireActor } from "../request-actor.js";
import { subscribeRoomEvents } from "../room-event-bus.js";
import { fetchJournalEventsAfter } from "../room-event-journal.js";
import { requireRoomRole } from "./route-guards.js";
import { roomIdParams } from "./schemas.js";

function writeSseEvent(raw, { id, payload }) {
  if (id !== undefined && id !== null) raw.write(`id: ${id}\n`);
  raw.write(`data: ${payload}\n\n`);
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
          writeSseEvent(reply.raw, {
            id: row.id,
            payload: JSON.stringify(row.payload)
          });
        }
      } catch {
        /* replay failure should not block live stream */
      }
    }

    writeSseEvent(reply.raw, {
      payload: JSON.stringify({ type: "connected", roomId, at: new Date().toISOString() })
    });

    const unsubscribe = subscribeRoomEvents(roomId, (message) => {
      const envelope = typeof message === "string" ? { payload: message } : message;
      writeSseEvent(reply.raw, envelope);
    });
    const heartbeat = setInterval(() => {
      writeSseEvent(reply.raw, {
        payload: JSON.stringify({ type: "heartbeat", roomId, at: new Date().toISOString() })
      });
    }, 25000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);
  });
}
