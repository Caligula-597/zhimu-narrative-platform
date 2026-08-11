import { sendErr } from "../api-errors.js";
import { listHostAuditLog } from "../audit-log.js";
import { requireActor } from "../request-actor.js";
import { getHostDiscoveryProgress } from "../room-discovery-service.js";
import { applyHostPaceClockAction, getRoomPaceClock } from "../room-pace-clock-service.js";
import {
  getHostClueMatrix,
  getHostPlayerDetail,
  getHostPlayers,
  getHostProgress,
  setHostClueNote
} from "../host-monitor-service.js";
import { requireHostMembership } from "./host-route-guards.js";
import { hostClueNoteSchema, roleSlotRoomParams, roomIdParams } from "./schemas.js";
import { paceClockActionSchema } from "./schemas/room-pace-clock.js";

export async function registerHostMonitorRoutes(app) {
  app.get("/api/rooms/:roomId/host/players", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const players = await getHostPlayers(roomId);
    return { players, stuckCount: players.filter((player) => player.maybe_stuck).length };
  });

  app.get("/api/rooms/:roomId/host/clue-matrix", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return getHostClueMatrix(roomId);
  });

  app.get("/api/rooms/:roomId/host/discovery-progress", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return getHostDiscoveryProgress(roomId);
  });

  app.get("/api/rooms/:roomId/host/pace-clock", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return getRoomPaceClock(roomId, { audience: "host" });
  });

  app.post("/api/rooms/:roomId/host/pace-clock/actions", { schema: paceClockActionSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return applyHostPaceClockAction({ roomId, actorId, input: request.body });
  });

  app.put("/api/rooms/:roomId/host/clues/:clueId/notes", { schema: hostClueNoteSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, clueId } = request.params;
    const { roleSlotId, hostNote = "" } = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    const savedNote = await setHostClueNote({ roomId, roleSlotId, clueId, hostNote });
    if (savedNote == null) return sendErr(reply, "CLUE_OWNERSHIP_NOT_FOUND");
    return { ok: true, hostNote: savedNote };
  });

  app.get("/api/rooms/:roomId/host/players/:roleSlotId", { schema: { params: roleSlotRoomParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, roleSlotId } = request.params;
    await requireHostMembership(actorId, roomId);
    const detail = await getHostPlayerDetail(roomId, roleSlotId);
    if (!detail) return sendErr(reply, "ROLE_SLOT_NOT_FOUND");
    return detail;
  });

  app.get("/api/rooms/:roomId/host/audit-log", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const limit = Math.min(Math.max(Number(request.query?.limit) || 50, 1), 200);
    return { entries: await listHostAuditLog(roomId, { limit }) };
  });

  app.get("/api/rooms/:roomId/host-progress", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return getHostProgress(roomId);
  });
}
