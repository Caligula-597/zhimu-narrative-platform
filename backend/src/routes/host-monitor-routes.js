import { query } from "../db.js";
import { sendErr } from "../api-errors.js";
import { listHostAuditLog } from "../audit-log.js";
import { requireActor } from "../request-actor.js";
import { fetchHostClueMatrix } from "./clue-helpers.js";
import { fetchHostPlayerDetail, fetchHostPlayers } from "./host-helpers.js";
import { assertRoleInRoomWorld, requireHostMembership } from "./host-route-guards.js";
import { hostClueNoteSchema, roleSlotRoomParams, roomIdParams } from "./schemas.js";

export async function registerHostMonitorRoutes(app) {
  app.get("/api/rooms/:roomId/host/players", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const players = await fetchHostPlayers(query, roomId);
    return { players, stuckCount: players.filter((player) => player.maybe_stuck).length };
  });

  app.get("/api/rooms/:roomId/host/clue-matrix", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return fetchHostClueMatrix(query, roomId);
  });

  app.put("/api/rooms/:roomId/host/clues/:clueId/notes", { schema: hostClueNoteSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, clueId } = request.params;
    const { roleSlotId, hostNote = "" } = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    await assertRoleInRoomWorld(query, roomId, roleSlotId);
    const result = await query(
      `UPDATE clue_ownership SET host_note = $4
       WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3
       RETURNING host_note`,
      [roomId, roleSlotId, clueId, hostNote]
    );
    if (!result.rowCount) return sendErr(reply, "CLUE_OWNERSHIP_NOT_FOUND");
    return { ok: true, hostNote: result.rows[0].host_note };
  });

  app.get("/api/rooms/:roomId/host/players/:roleSlotId", { schema: { params: roleSlotRoomParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, roleSlotId } = request.params;
    await requireHostMembership(actorId, roomId);
    const detail = await fetchHostPlayerDetail(query, roomId, roleSlotId);
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
    const players = await fetchHostPlayers(query, roomId);
    return players.map((player) => ({
      role_slot_id: player.role_slot_id,
      name: player.role_name,
      total_sections: player.total_sections,
      completed_sections: player.completed_sections,
      current_scene_id: player.current_scene_id,
      updated_at: player.last_activity_at
    }));
  });
}
