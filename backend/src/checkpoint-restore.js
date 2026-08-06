import { throwErr } from "./api-errors.js";
import { buildRoomCheckpointSnapshot } from "./checkpoint-snapshot.js";
import {
  appendCheckpointRestoreLog,
  lockCheckpointTargetRoom
} from "./repositories/checkpoint-repository.js";
import {
  applyCheckpointState,
  clearCheckpointScope
} from "./repositories/checkpoint-restore-state-repository.js";
import {
  appendRoomMechanismAction,
  findRoomMechanismState,
  insertRoomMechanismState,
  updateRoomMechanismRuntime
} from "./repositories/room-mechanism-runtime-repository.js";

export const DEFAULT_CHECKPOINT_RESTORE_SCOPE = Object.freeze({
  readingProgress: true,
  clueOwnership: true,
  inventory: true,
  contentUnlocks: true,
  pendingHostEvents: true,
  investigationRecords: true,
  playerStates: true,
  ruleExecutions: true,
  mechanismRuntime: true,
  timelineLogs: false
});

const DATASET_LIMITS = Object.freeze({
  readingProgress: 50_000,
  clueOwnership: 50_000,
  inventory: 20_000,
  contentUnlocks: 50_000,
  pendingEvents: 10_000,
  investigationRecords: 50_000,
  playerStates: 10_000,
  ruleExecutions: 10_000,
  timelineLogs: 100_000
});

const SCOPE_DATASETS = Object.freeze({
  readingProgress: "readingProgress",
  clueOwnership: "clueOwnership",
  inventory: "inventory",
  contentUnlocks: "contentUnlocks",
  pendingHostEvents: "pendingEvents",
  investigationRecords: "investigationRecords",
  playerStates: "playerStates",
  ruleExecutions: "ruleExecutions",
  timelineLogs: "timelineLogs"
});

export function resolveCheckpointRestoreScope(input = {}) {
  const scope = { ...DEFAULT_CHECKPOINT_RESTORE_SCOPE };
  for (const key of Object.keys(scope)) {
    if (typeof input?.[key] === "boolean") scope[key] = input[key];
  }
  return scope;
}

function snapshotArray(snapshot, key, maxRows) {
  const value = snapshot[key];
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > maxRows) {
    throwErr("INVALID_SNAPSHOT", undefined, {
      dataset: key,
      reason: !Array.isArray(value) ? "not_array" : "row_limit_exceeded",
      maxRows
    });
  }
  return value;
}

export function validateRestoreSnapshot(snapshot, scopeInput = {}) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throwErr("INVALID_SNAPSHOT");
  }
  const version = Number(snapshot.schemaVersion ?? 1);
  if (!Number.isInteger(version) || version < 2) {
    throwErr("SNAPSHOT_VERSION_UNSUPPORTED", undefined, { schemaVersion: version });
  }
  const scope = resolveCheckpointRestoreScope(scopeInput);
  // V2 snapshots predate mechanism runtime capture. Treat the missing dataset
  // as "not captured", never as an instruction to erase current room state.
  if (version < 3) scope.mechanismRuntime = false;
  if (scope.mechanismRuntime && snapshot.mechanismRuntime != null) {
    const mechanism = snapshot.mechanismRuntime;
    if (!mechanism || typeof mechanism !== "object" || Array.isArray(mechanism)
      || !mechanism.runtime || typeof mechanism.runtime !== "object" || Array.isArray(mechanism.runtime)
      || !Number.isInteger(Number(mechanism.mechanismSchemaVersion))
      || !Number.isInteger(Number(mechanism.sourceContentRevision))
      || !/^[0-9a-f]{64}$/.test(String(mechanism.mechanismPackageSha256 ?? ""))) {
      throwErr("INVALID_SNAPSHOT", undefined, { dataset: "mechanismRuntime", reason: "invalid_runtime_binding" });
    }
  }
  if (scope.timelineLogs && snapshot.timelineLogsTruncated === true) {
    throwErr("SNAPSHOT_TIMELINE_TRUNCATED");
  }
  for (const [scopeKey, dataset] of Object.entries(SCOPE_DATASETS)) {
    if (scope[scopeKey]) snapshotArray(snapshot, dataset, DATASET_LIMITS[dataset]);
  }
  return scope;
}

function value(row, snakeKey, camelKey, fallback = null) {
  return row?.[snakeKey] ?? row?.[camelKey] ?? fallback;
}

function normalizeCheckpointState(snapshot) {
  const now = new Date().toISOString();
  const rows = (key) => Array.isArray(snapshot[key]) ? snapshot[key] : [];
  return {
    readingProgress: rows("readingProgress").map((row) => ({
      role_slot_id: value(row, "role_slot_id", "roleSlotId"),
      script_section_id: value(row, "script_section_id", "scriptSectionId"),
      started_at: value(row, "started_at", "startedAt", now),
      completed_at: value(row, "completed_at", "completedAt")
    })),
    inventory: rows("inventory").map((row) => ({
      role_slot_id: value(row, "role_slot_id", "roleSlotId"),
      item_id: value(row, "item_id", "itemId"),
      quantity: row?.quantity ?? 1,
      metadata: row?.metadata ?? {}
    })),
    contentUnlocks: rows("contentUnlocks").map((row) => ({
      content_type: value(row, "content_type", "contentType"),
      content_id: value(row, "content_id", "contentId"),
      unlocked_at: value(row, "unlocked_at", "unlockedAt", now),
      unlocked_by_rule_id: value(row, "unlocked_by_rule_id", "unlockedByRuleId")
    })),
    clueOwnership: rows("clueOwnership").map((row) => ({
      role_slot_id: value(row, "role_slot_id", "roleSlotId"),
      clue_id: value(row, "clue_id", "clueId"),
      acquired_at: value(row, "acquired_at", "acquiredAt", now),
      read_at: value(row, "read_at", "readAt"),
      shared_with_room: value(row, "shared_with_room", "sharedWithRoom", false),
      shared_with_roles: value(row, "shared_with_roles", "sharedWithRoles", []),
      player_note: value(row, "player_note", "playerNote", ""),
      host_note: value(row, "host_note", "hostNote", ""),
      shared_at: value(row, "shared_at", "sharedAt")
    })),
    pendingEvents: rows("pendingEvents")
      .filter((row) => ["pending", "delayed"].includes(row?.status ?? "pending"))
      .map((row) => ({
        rule_id: value(row, "rule_id", "ruleId"),
        event_key: value(row, "event_key", "eventKey", `restore-${row?.id ?? "event"}`),
        title: row?.title ?? "",
        description: row?.description ?? "",
        actions: row?.actions ?? [],
        status: row?.status ?? "pending",
        created_at: value(row, "created_at", "createdAt", now),
        delay_until: value(row, "delay_until", "delayUntil")
      })),
    investigationRecords: rows("investigationRecords").map((row) => ({
      investigation_point_id: value(row, "investigation_point_id", "investigationPointId"),
      role_slot_id: value(row, "role_slot_id", "roleSlotId"),
      result: row?.result ?? {},
      investigated_at: value(row, "investigated_at", "investigatedAt", now)
    })),
    playerStates: rows("playerStates").map((row) => ({
      role_slot_id: value(row, "role_slot_id", "roleSlotId"),
      current_scene_id: value(row, "current_scene_id", "currentSceneId"),
      variables: row?.variables ?? {},
      updated_at: value(row, "updated_at", "updatedAt", now)
    })),
    ruleExecutions: rows("ruleExecutions").map((row) => ({
      rule_id: value(row, "rule_id", "ruleId"),
      result: row?.result ?? {},
      executed_at: value(row, "executed_at", "executedAt", now)
    })),
    timelineLogs: rows("timelineLogs").map((row) => ({
      actor_user_id: value(row, "actor_user_id", "actorUserId"),
      visibility: row?.visibility ?? "host",
      event_type: value(row, "event_type", "eventType"),
      message: row?.message ?? "",
      metadata: row?.metadata ?? {},
      created_at: value(row, "created_at", "createdAt", now)
    }))
  };
}

function projectBeforeSnapshot(snapshot, scope) {
  const projected = {
    schemaVersion: snapshot.schemaVersion,
    roomId: snapshot.roomId,
    roomName: snapshot.roomName,
    roomStatus: snapshot.roomStatus,
    phase: snapshot.phase,
    capturedScope: scope
  };
  for (const [scopeKey, dataset] of Object.entries(SCOPE_DATASETS)) {
    if (scope[scopeKey]) projected[dataset] = snapshot[dataset] ?? [];
  }
  if (scope.mechanismRuntime) projected.mechanismRuntime = snapshot.mechanismRuntime ?? null;
  if (scope.timelineLogs) projected.timelineLogsTruncated = snapshot.timelineLogsTruncated === true;
  return projected;
}

function mechanismBindingMatches(current, captured) {
  return current.mechanismSchemaVersion === Number(captured.mechanismSchemaVersion)
    && current.contentBindingMode === captured.contentBindingMode
    && current.contentReleaseId === (captured.contentReleaseId ?? null)
    && current.sourceContentRevision === Number(captured.sourceContentRevision)
    && current.mechanismPackageSha256 === captured.mechanismPackageSha256;
}

export async function restoreMechanismRuntimeFromCheckpoint(client, {
  roomId,
  sourceRoomId,
  actorId,
  captured,
  checkpointId = null,
  restoreId = null
}) {
  if (captured == null) return { applied: false, reason: "not_initialized_at_capture" };
  if (sourceRoomId !== roomId) throwErr("CHECKPOINT_MECHANISM_CROSS_ROOM_UNSUPPORTED");

  const current = await findRoomMechanismState(roomId, { client, forUpdate: true });
  if (current && !mechanismBindingMatches(current, captured)) {
    throwErr("MECHANISM_RUNTIME_CONTENT_MISMATCH", undefined, {
      expectedSha256: current.mechanismPackageSha256,
      capturedSha256: captured.mechanismPackageSha256
    });
  }

  const revisionBefore = current?.revision ?? 0;
  const restored = current
    ? await updateRoomMechanismRuntime(client, {
        roomId,
        expectedRevision: current.revision,
        runtime: captured.runtime
      })
    : await insertRoomMechanismState(client, {
        roomId,
        mechanismSchemaVersion: Number(captured.mechanismSchemaVersion),
        contentBindingMode: captured.contentBindingMode,
        contentReleaseId: captured.contentReleaseId ?? null,
        sourceContentRevision: Number(captured.sourceContentRevision),
        mechanismPackageSha256: captured.mechanismPackageSha256,
        actorId,
        runtime: captured.runtime,
        metadata: { restoredFromCheckpoint: true }
      });

  if (!restored) {
    throwErr("MECHANISM_RUNTIME_REVISION_CONFLICT", undefined, { expectedRevision: revisionBefore });
  }
  await appendRoomMechanismAction(client, {
    roomId,
    actorId,
    revisionBefore,
    revisionAfter: restored.revision,
    roundKey: restored.runtime.currentRoundKey,
    actionType: "override",
    actionKey: "checkpoint-restore",
    changes: [{
      targetType: "runtime",
      targetKey: "checkpoint",
      operation: "restore",
      capturedRevision: Number(captured.capturedRevision ?? 0),
      revisionBefore,
      revisionAfter: restored.revision
    }],
    request: { checkpointId, restoreId },
    metadata: { source: "checkpoint-restore" }
  });
  return { applied: true, revisionBefore, revisionAfter: restored.revision };
}

export async function restoreRoomFromCheckpoint(client, roomId, snapshot, scopeInput = {}, options = {}) {
  const scope = validateRestoreSnapshot(snapshot, scopeInput);
  const sourceRoomId = options.sourceRoomId ?? snapshot.roomId ?? null;
  if (!options.roomLocked) {
    const locked = await lockCheckpointTargetRoom(client, roomId);
    if (!locked) throwErr("ROOM_NOT_FOUND");
  }

  const fullBeforeSnapshot = await buildRoomCheckpointSnapshot(roomId, {
    client,
    includeTimelineLogs: scope.timelineLogs
  });
  const beforeSnapshot = projectBeforeSnapshot(fullBeforeSnapshot, scope);
  const state = normalizeCheckpointState(snapshot);
  await clearCheckpointScope(client, roomId, scope);
  await applyCheckpointState(client, roomId, state, scope);
  const mechanismRestore = scope.mechanismRuntime
    ? await restoreMechanismRuntimeFromCheckpoint(client, {
        roomId,
        sourceRoomId,
        actorId: options.actorId ?? null,
        captured: snapshot.mechanismRuntime ?? null,
        checkpointId: options.checkpointId ?? null,
        restoreId: options.restoreId ?? null
      })
    : { applied: false, reason: "scope_disabled" };
  await appendCheckpointRestoreLog(client, { roomId, snapshot, scope, sourceRoomId });
  return { beforeSnapshot, scope, sourceRoomId, targetRoomId: roomId, mechanismRestore };
}
