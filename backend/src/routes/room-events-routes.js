import { requireActor } from "../request-actor.js";
import { subscribeRoomEvents } from "../room-event-bus.js";
import { requireRoomRole } from "./route-guards.js";
import { roomIdParams } from "./schemas.js";

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

    const writeEvent = (payload) => {
      reply.raw.write(`data: ${payload}\n\n`);
    };

    writeEvent(JSON.stringify({ type: "connected", roomId, at: new Date().toISOString() }));

    const unsubscribe = subscribeRoomEvents(roomId, writeEvent);
    const heartbeat = setInterval(() => {
      writeEvent(JSON.stringify({ type: "heartbeat", roomId, at: new Date().toISOString() }));
    }, 25000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);
  });
}
