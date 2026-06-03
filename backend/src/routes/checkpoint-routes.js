import { query } from "../db.js";
import { requireActor } from "../request-actor.js";
import { requireRoomRole } from "./route-guards.js";
import { buildRoomCheckpointSnapshot, summarizeCheckpoint } from "./checkpoint-helpers.js";
import { checkpointIdParams, createCheckpointSchema, roomIdParams } from "./schemas.js";

async function requireHostMembership(actorId, roomId) {
  const membership = await requireRoomRole(actorId, roomId);
  if (!["host", "cohost"].includes(membership.member_type)) {
    throw Object.assign(new Error("Host role required"), { statusCode: 403 });
  }
  return membership;
}

export async function registerCheckpointRoutes(app) {
  app.get("/api/rooms/:roomId/checkpoints", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const result = await query(
      `SELECT cp.id, cp.label, cp.snapshot, cp.created_at,
              u.display_name AS created_by_name
       FROM checkpoints cp
       JOIN users u ON u.id = cp.created_by_user_id
       WHERE cp.room_id = $1
       ORDER BY cp.created_at DESC`,
      [roomId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      label: row.label,
      description: row.snapshot?.description ?? "",
      created_at: row.created_at,
      created_by_name: row.created_by_name,
      summary: summarizeCheckpoint(row.snapshot)
    }));
  });

  app.get("/api/rooms/:roomId/checkpoints/:checkpointId", { schema: { params: checkpointIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, checkpointId } = request.params;
    await requireHostMembership(actorId, roomId);
    const result = await query(
      `SELECT cp.id, cp.label, cp.snapshot, cp.created_at, cp.room_id,
              u.display_name AS created_by_name
       FROM checkpoints cp
       JOIN users u ON u.id = cp.created_by_user_id
       WHERE cp.id = $1 AND cp.room_id = $2`,
      [checkpointId, roomId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Checkpoint not found" });
    const row = result.rows[0];
    return {
      id: row.id,
      label: row.label,
      description: row.snapshot?.description ?? "",
      created_at: row.created_at,
      created_by_name: row.created_by_name,
      snapshot: row.snapshot,
      summary: summarizeCheckpoint(row.snapshot)
    };
  });

  app.post("/api/rooms/:roomId/checkpoints", { schema: createCheckpointSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { title, description = "" } = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    const snapshot = await buildRoomCheckpointSnapshot(query, roomId);
    if (!snapshot) return reply.code(404).send({ error: "Room not found" });
    snapshot.description = description.trim();
    const result = await query(
      `INSERT INTO checkpoints (room_id, created_by_user_id, label, snapshot)
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
      snapshot: row.snapshot,
      summary: summarizeCheckpoint(row.snapshot)
    });
  });
}
