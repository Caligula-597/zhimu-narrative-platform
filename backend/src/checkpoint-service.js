import { httpError, throwErr } from "./api-errors.js";
import { buildRoomCheckpointSnapshot, summarizeCheckpoint } from "./checkpoint-snapshot.js";
import { resolveCheckpointRestoreScope, restoreRoomFromCheckpoint, validateRestoreSnapshot } from "./checkpoint-restore.js";
import { transaction } from "./db.js";
import {
  configureCheckpointTransaction,
  findCheckpoint,
  findCheckpointRestoreContext,
  insertCheckpoint,
  insertCheckpointRestoreAudit,
  insertPendingCheckpointRestore,
  listCheckpointRestores,
  listCheckpointSummaries,
  lockCheckpointTargetRoom,
  markCheckpointRestoreApplied,
  markCheckpointRestoreFailed
} from "./repositories/checkpoint-repository.js";
import { transactionWithEvents } from "./transaction-events.js";

export async function listRoomCheckpoints(roomId) {
  return listCheckpointSummaries(roomId);
}

export async function getRoomCheckpoint(roomId, checkpointId) {
  const row = await findCheckpoint(roomId, checkpointId);
  if (!row) throwErr("CHECKPOINT_NOT_FOUND");
  return {
    id: row.id,
    label: row.label,
    description: row.snapshot?.description ?? "",
    created_at: row.created_at,
    created_by_name: row.created_by_name,
    snapshot: row.snapshot,
    summary: summarizeCheckpoint(row.snapshot)
  };
}

export async function createRoomCheckpoint({ roomId, actorId, title, description = "" }) {
  return transaction(async (client) => {
    await configureCheckpointTransaction(client);
    // Snapshot assembly is one SQL statement, so every component is observed
    // at the same PostgreSQL statement snapshot.
    const snapshot = await buildRoomCheckpointSnapshot(roomId, { client });
    if (!snapshot) throwErr("ROOM_NOT_FOUND");
    snapshot.description = description.trim();
    const row = await insertCheckpoint(client, {
      roomId,
      actorId,
      title: title.trim(),
      snapshot
    });
    return {
      id: row.id,
      label: row.label,
      description: row.snapshot?.description ?? "",
      schema_version: row.schema_version,
      created_at: row.created_at,
      snapshot: row.snapshot,
      summary: summarizeCheckpoint(row.snapshot)
    };
  });
}

export async function listRoomCheckpointRestores(roomId, checkpointId) {
  return listCheckpointRestores(roomId, checkpointId);
}

function assertRestoreContext(context) {
  if (!context) throwErr("CHECKPOINT_NOT_FOUND");
  if (!context.target_room_id) throwErr("ROOM_NOT_FOUND");
  if (context.source_world_id !== context.target_world_id) {
    throwErr("CHECKPOINT_WORLD_MISMATCH");
  }
  return context;
}

function publicRestoreFailureMessage(error) {
  const status = Number(error?.statusCode ?? error?.status ?? 500);
  if (status >= 400 && status < 500 && typeof error?.code === "string") {
    return String(error.message || "恢复请求无效").slice(0, 500);
  }
  return "恢复失败，内部错误已记录，请稍后重试或联系运维。";
}

function normalizeRestoreError(error) {
  if (["22P02", "22007", "23502", "23503", "23505", "23514"].includes(error?.code)) {
    return httpError(422, "Checkpoint snapshot contains invalid or stale data", "INVALID_SNAPSHOT");
  }
  if (["40P01", "55P03"].includes(error?.code)) {
    return httpError(409, "Another checkpoint restore is in progress; retry shortly", "CHECKPOINT_RESTORE_BUSY");
  }
  if (error?.code === "57014") {
    return httpError(503, "Checkpoint restore exceeded its safe execution window", "CHECKPOINT_RESTORE_TIMEOUT");
  }
  return error;
}

export async function restoreRoomCheckpoint({ targetRoomId, checkpointId, actorId, scope: scopeInput = {} }) {
  const initialContext = assertRestoreContext(
    await findCheckpointRestoreContext(checkpointId, targetRoomId)
  );
  const scope = resolveCheckpointRestoreScope(scopeInput);
  validateRestoreSnapshot(initialContext.snapshot, scope);

  const pending = await insertPendingCheckpointRestore({
    roomId: targetRoomId,
    checkpointId,
    actorId,
    scope
  });
  const restoreId = pending.id;

  try {
    const result = await transactionWithEvents(async (client, queueEvent) => {
      await configureCheckpointTransaction(client);
      // Serialize restores before reading target state. READ COMMITTED then
      // observes the preceding restore after the room lock is acquired.
      const locked = await lockCheckpointTargetRoom(client, targetRoomId);
      if (!locked) throwErr("ROOM_NOT_FOUND");
      const context = assertRestoreContext(
        await findCheckpointRestoreContext(checkpointId, targetRoomId, { client })
      );
      const restored = await restoreRoomFromCheckpoint(
        client,
        targetRoomId,
        context.snapshot,
        scope,
        { sourceRoomId: context.source_room_id, roomLocked: true }
      );
      const restoreResult = {
        scope: restored.scope,
        sourceRoomId: restored.sourceRoomId,
        targetRoomId: restored.targetRoomId
      };
      await markCheckpointRestoreApplied(client, {
        restoreId,
        beforeSnapshot: restored.beforeSnapshot,
        result: restoreResult
      });
      await insertCheckpointRestoreAudit(client, {
        roomId: targetRoomId,
        actorId,
        checkpointId,
        restoreId,
        scope: restored.scope,
        sourceRoomId: restored.sourceRoomId
      });
      queueEvent(targetRoomId, "room.checkpoint_restored", {
        checkpointId,
        restoreId,
        sourceRoomId: restored.sourceRoomId,
        crossRoom: restored.sourceRoomId !== targetRoomId
      });
      return { context, restored };
    });

    return {
      ok: true,
      restoreId,
      status: "applied",
      checkpointId,
      sourceRoomId: result.restored.sourceRoomId,
      targetRoomId: result.restored.targetRoomId,
      crossRoom: result.restored.sourceRoomId !== targetRoomId,
      schemaVersion: result.context.schema_version,
      scope: result.restored.scope
    };
  } catch (error) {
    const normalized = normalizeRestoreError(error);
    await markCheckpointRestoreFailed(restoreId, publicRestoreFailureMessage(normalized)).catch(() => {});
    throw normalized;
  }
}
