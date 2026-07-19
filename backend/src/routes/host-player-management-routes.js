import {
  kickHostPlayer,
  saveHostPlayerNotes
} from "../host-player-management-service.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { requireActor } from "../request-actor.js";
import {
  hostPlayerKickSchema,
  hostPlayerNotesSchema
} from "./schemas/host-player-management.js";

export async function registerHostPlayerManagementRoutes(app) {
  app.put(
    "/api/rooms/:roomId/host/players/:roleSlotId/notes",
    { schema: hostPlayerNotesSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId, roleSlotId } = request.params;
      return withRoomIdempotency(roomId, request, "host.player_notes", () => saveHostPlayerNotes({
        actorId,
        roomId,
        roleSlotId,
        notes: request.body?.notes
      }));
    }
  );

  app.post(
    "/api/rooms/:roomId/host/players/:roleSlotId/kick",
    { schema: hostPlayerKickSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId, roleSlotId } = request.params;
      return withRoomIdempotency(roomId, request, "host.player_kick", () => kickHostPlayer({
        actorId,
        roomId,
        roleSlotId
      }));
    }
  );
}
