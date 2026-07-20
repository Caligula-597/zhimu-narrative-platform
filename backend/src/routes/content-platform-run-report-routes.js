import { requireActor } from "../request-actor.js";
import { getRoomRunReport } from "../content-platform-run-report-service.js";
import { requireHostMembership } from "./content-platform-room-access.js";
import { roomIdParams } from "./schemas.js";

export async function registerContentPlatformRunReportRoutes(app) {
  app.get("/api/rooms/:roomId/run-report", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return getRoomRunReport(roomId);
  });
}
