import { query } from "../db.js";
import { requireActor } from "../request-actor.js";
import { requireRoomRole } from "./route-guards.js";
import { sendErr, throwErr } from "../api-errors.js";
import { logHostAction } from "../audit-log.js";
import { transactionWithEvents } from "../transaction-events.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { buildRoomCheckpointSnapshot, summarizeCheckpoint } from "./checkpoint-helpers.js";
import { restoreRoomFromCheckpoint } from "./checkpoint-restore-helpers.js";
import { checkpointIdParams, createCheckpointSchema, restoreCheckpointSchema, roomIdParams } from "./schemas.js";

async function requireHostMembership(actorId, roomId) {
  const membership = await requireRoomRole(actorId, roomId);
  if (!["host", "cohost"].includes(membership.member_type)) {
    throwErr("HOST_ROLE_REQUIRED");
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
    if (!result.rowCount) return sendErr(reply, "CHECKPOINT_NOT_FOUND");
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
    const snapshot = await buildRoomCheckpointSnapshot(roomId);
    if (!snapshot) return sendErr(reply, "ROOM_NOT_FOUND");
    snapshot.description = description.trim();
    const result = await query(
      `INSERT INTO checkpoints (room_id, created_by_user_id, label, snapshot, schema_version)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING id, label, snapshot, schema_version, created_at`,
      [roomId, actorId, title.trim(), JSON.stringify(snapshot), snapshot.schemaVersion ?? 2]
    );
    const row = result.rows[0];
    return reply.code(201).send({
      id: row.id,
      label: row.label,
      description: row.snapshot?.description ?? "",
      schema_version: row.schema_version,
      created_at: row.created_at,
      snapshot: row.snapshot,
      summary: summarizeCheckpoint(row.snapshot)
    });
  });

  app.get("/api/rooms/:roomId/checkpoints/:checkpointId/restores", { schema: { params: checkpointIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, checkpointId } = request.params;
    await requireHostMembership(actorId, roomId);
    const result = await query(
      `SELECT cr.id, cr.status, cr.restore_scope, cr.error_message, cr.applied_at, cr.created_at,
              u.display_name AS requested_by_name
       FROM checkpoint_restores cr
       JOIN users u ON u.id = cr.requested_by_user_id
       WHERE cr.room_id = $1 AND cr.checkpoint_id = $2
       ORDER BY cr.created_at DESC`,
      [roomId, checkpointId]
    );
    return result.rows;
  });

  app.post("/api/rooms/:roomId/checkpoints/:checkpointId/restore", { schema: restoreCheckpointSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const targetRoomId = request.params.roomId;
    const { checkpointId } = request.params;
    const scope = request.body?.scope ?? {};
    await requireHostMembership(actorId, targetRoomId);

    const checkpoint = await query(
      `SELECT cp.id, cp.schema_version, cp.snapshot, cp.room_id AS source_room_id,
              sr.world_id AS source_world_id
       FROM checkpoints cp
       JOIN rooms sr ON sr.id = cp.room_id
       WHERE cp.id = $1`,
      [checkpointId]
    );
    if (!checkpoint.rowCount) return sendErr(reply, "CHECKPOINT_NOT_FOUND");

    const targetRoom = await query(`SELECT id, world_id FROM rooms WHERE id = $1`, [targetRoomId]);
    if (!targetRoom.rowCount) return sendErr(reply, "ROOM_NOT_FOUND");
    if (targetRoom.rows[0].world_id !== checkpoint.rows[0].source_world_id) {
      return sendErr(reply, "CHECKPOINT_WORLD_MISMATCH");
    }

    const sourceRoomId = checkpoint.rows[0].source_room_id;

    return withRoomIdempotency(targetRoomId, request, "checkpoints.restore", async () => {
      const pending = await query(
        `INSERT INTO checkpoint_restores (room_id, checkpoint_id, requested_by_user_id, status, restore_scope)
         VALUES ($1, $2, $3, 'pending', $4::jsonb)
         RETURNING id`,
        [targetRoomId, checkpointId, actorId, JSON.stringify(scope)]
      );
      const restoreId = pending.rows[0].id;

      try {
        const result = await transactionWithEvents(async (client, queueEvent) => {
          const restored = await restoreRoomFromCheckpoint(
            client,
            targetRoomId,
            checkpoint.rows[0].snapshot,
            scope,
            { sourceRoomId }
          );
          await client.query(
            `UPDATE checkpoint_restores
             SET status = 'applied', before_snapshot = $2::jsonb, applied_at = now(), result = $3::jsonb
             WHERE id = $1`,
            [
              restoreId,
              JSON.stringify(restored.beforeSnapshot),
              JSON.stringify({
                scope: restored.scope,
                sourceRoomId: restored.sourceRoomId,
                targetRoomId: restored.targetRoomId
              })
            ]
          );
          queueEvent(targetRoomId, "room.checkpoint_restored", {
            checkpointId,
            restoreId,
            sourceRoomId,
            crossRoom: sourceRoomId !== targetRoomId
          });
          return restored;
        });

        await logHostAction({
          roomId: targetRoomId,
          actorUserId: actorId,
          action: "checkpoint_restore",
          targetType: "checkpoint",
          targetId: checkpointId,
          metadata: {
            restoreId,
            scope: result.scope,
            sourceRoomId: result.sourceRoomId,
            crossRoom: result.sourceRoomId !== targetRoomId
          }
        });

        return {
          ok: true,
          restoreId,
          status: "applied",
          checkpointId,
          sourceRoomId: result.sourceRoomId,
          targetRoomId: result.targetRoomId,
          crossRoom: result.sourceRoomId !== targetRoomId,
          schemaVersion: checkpoint.rows[0].schema_version,
          scope: result.scope
        };
      } catch (error) {
        await query(
          `UPDATE checkpoint_restores
           SET status = 'failed', error_message = $2, applied_at = now()
           WHERE id = $1`,
          [restoreId, error.message]
        );
        throw error;
      }
    });
  });
}
