import { query } from "../db.js";
import { sendErr, throwErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { requireRoomRole } from "./route-guards.js";
import { buildRoomRecapSnapshot, filterRecapForPlayer, summarizeRecap } from "./recap-helpers.js";
import { createRecapSchema, recapIdParams, roomIdParams } from "./schemas.js";

async function requireHostMembership(actorId, roomId) {
  const membership = await requireRoomRole(actorId, roomId);
  if (!["host", "cohost"].includes(membership.member_type)) {
    throwErr("HOST_ROLE_REQUIRED");
  }
  return membership;
}

function mapRecapListRow(row) {
  return {
    id: row.id,
    label: row.label,
    description: row.snapshot?.description ?? "",
    created_at: row.created_at,
    created_by_name: row.created_by_name,
    summary: summarizeRecap(row.snapshot)
  };
}

export async function registerRecapRoutes(app) {
  app.get("/api/rooms/:roomId/recaps", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const result = await query(
      `SELECT rr.id, rr.label, rr.snapshot, rr.created_at, u.display_name AS created_by_name
       FROM room_recaps rr
       JOIN users u ON u.id = rr.created_by_user_id
       WHERE rr.room_id = $1
       ORDER BY rr.created_at DESC`,
      [roomId]
    );
    return result.rows.map(mapRecapListRow);
  });

  app.get("/api/rooms/:roomId/recaps/:recapId", { schema: { params: recapIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, recapId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    const result = await query(
      `SELECT rr.id, rr.label, rr.snapshot, rr.created_at, rr.room_id, u.display_name AS created_by_name
       FROM room_recaps rr
       JOIN users u ON u.id = rr.created_by_user_id
       WHERE rr.id = $1 AND rr.room_id = $2`,
      [recapId, roomId]
    );
    if (!result.rowCount) return sendErr(reply, "RECAP_NOT_FOUND");
    const row = result.rows[0];
    const isHost = ["host", "cohost"].includes(membership.member_type);
    let snapshot = row.snapshot;
    let perspective = "host";
    if (!isHost) {
      if (!membership.role_slot_id) {
        return sendErr(reply, "PLAYER_ROLE_REQUIRED", "Player role selection required");
      }
      snapshot = filterRecapForPlayer(row.snapshot, membership.role_slot_id);
      perspective = "postgame";
    } else {
      snapshot = { ...snapshot, perspective: "host" };
    }
    return {
      id: row.id,
      label: row.label,
      description: row.snapshot?.description ?? "",
      created_at: row.created_at,
      created_by_name: row.created_by_name,
      perspective,
      snapshot,
      summary: summarizeRecap(row.snapshot)
    };
  });

  app.get("/api/rooms/:roomId/recap/latest", { schema: { params: roomIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    const result = await query(
      `SELECT rr.id, rr.label, rr.snapshot, rr.created_at, u.display_name AS created_by_name
       FROM room_recaps rr
       JOIN users u ON u.id = rr.created_by_user_id
       WHERE rr.room_id = $1
       ORDER BY rr.created_at DESC
       LIMIT 1`,
      [roomId]
    );
    if (!result.rowCount) return sendErr(reply, "RECAP_NOT_GENERATED");
    const row = result.rows[0];
    const isHost = ["host", "cohost"].includes(membership.member_type);
    let snapshot = row.snapshot;
    let perspective = "host";
    if (!isHost) {
      if (!membership.role_slot_id) {
        return sendErr(reply, "PLAYER_ROLE_REQUIRED", "Player role selection required");
      }
      snapshot = filterRecapForPlayer(row.snapshot, membership.role_slot_id);
      perspective = "postgame";
    } else {
      snapshot = { ...snapshot, perspective: "host" };
    }
    return {
      id: row.id,
      label: row.label,
      description: row.snapshot?.description ?? "",
      created_at: row.created_at,
      created_by_name: row.created_by_name,
      perspective,
      snapshot,
      summary: summarizeRecap(row.snapshot)
    };
  });

  app.post("/api/rooms/:roomId/recaps", { schema: createRecapSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { title, description = "" } = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    const snapshot = await buildRoomRecapSnapshot(query, roomId);
    if (!snapshot) return sendErr(reply, "ROOM_NOT_FOUND");
    snapshot.description = description.trim();
    const result = await query(
      `INSERT INTO room_recaps (room_id, created_by_user_id, label, snapshot)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, label, snapshot, created_at`,
      [roomId, actorId, title.trim(), JSON.stringify(snapshot)]
    );
    const row = result.rows[0];
    return reply.code(201).send({
      id: row.id,
      label: row.label,
      description: row.snapshot?.description ?? "",
      created_at: row.created_at,
      perspective: "host",
      snapshot: { ...row.snapshot, perspective: "host" },
      summary: summarizeRecap(row.snapshot)
    });
  });
}
