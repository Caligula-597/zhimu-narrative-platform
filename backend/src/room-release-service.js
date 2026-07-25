import { createHash } from "node:crypto";
import { throwErr } from "./api-errors.js";
import { compareCreatorSnapshots } from "./creator-review-diff.js";
import { transaction } from "./db.js";
import {
  findCreatorRoomActorRole,
  findCreatorRoomHostMembership,
  lockCreatorRoomActor,
  lockCreatorRoomHostMembership
} from "./repositories/creator-room-repository.js";
import {
  configureRoomReleaseTransaction,
  insertRoomReleaseAudit,
  loadRoomReleaseBinding,
  loadRoomReleaseSnapshot,
  lockRoomAssignedRoleIds,
  updateRoomReleaseBinding
} from "./repositories/room-release-repository.js";
import { projectRoomContentBinding, withRoomContentBinding } from "./room-content-binding.js";
import { transactionWithEvents } from "./transaction-events.js";
import {
  assertWorldReleaseSnapshot,
  projectWorldRelease
} from "./world-release-contract.js";
import { buildWorldReleaseCandidate } from "./world-release-snapshot.js";

const ROOM_RELEASE_EDITOR_ROLES = new Set(["owner", "editor"]);
const STARTED_ROOM_STATUSES = new Set(["active", "paused", "completed", "archived"]);
const APPLY_GUARD_COMPARISON = Object.freeze({
  summary: Object.freeze({ added: 0, removed: 0, changed: 0 }),
  world: Object.freeze({}),
  domains: Object.freeze({})
});

function normalizeEvidence(value = {}) {
  return Object.fromEntries(
    Object.entries(value || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, count]) => [key, Math.max(0, Number(count) || 0)])
  );
}

function impactDirection(room, targetRelease) {
  const currentNumber = Number(room.release_number) || 0;
  const targetNumber = Number(targetRelease.release_number) || 0;
  if (!room.release_id) return "bind";
  if (String(room.release_id) === String(targetRelease.id)) return "same";
  return targetNumber > currentNumber ? "upgrade" : "downgrade";
}

function impactFingerprint(room, targetRelease) {
  const assignedRoleIds = [...new Set((room.assigned_role_ids || []).map(String))].sort();
  const evidence = normalizeEvidence(room.runtime_evidence);
  const liveDraftRevision = room.release_id ? null : Number(room.current_content_revision) || null;
  return createHash("sha256")
    .update(JSON.stringify({
      roomId: room.id,
      currentReleaseId: room.release_id ?? null,
      liveDraftRevision,
      status: room.status,
      startedAt: room.started_at ?? null,
      assignedRoleIds,
      evidence,
      targetReleaseId: targetRelease.id,
      targetContentSha256: targetRelease.content_sha256
    }))
    .digest("hex");
}

function assertReleaseSnapshot(release) {
  try {
    return assertWorldReleaseSnapshot(release.snapshot);
  } catch (error) {
    throwErr("WORLD_RELEASE_SNAPSHOT_INVALID", error.message);
  }
}

async function assertRoomReleaseManager(client, { actorId, room, role, lock = false }) {
  if (ROOM_RELEASE_EDITOR_ROLES.has(role) || room.host_user_id === actorId) return;
  const membership = lock
    ? await lockCreatorRoomHostMembership(client, { roomId: room.id, actorId })
    : await findCreatorRoomHostMembership({ roomId: room.id, actorId }, client);
  if (!membership) throwErr("ROOM_RELEASE_CHANGE_FORBIDDEN");
}

export function evaluateRoomReleaseImpact({
  room,
  targetRelease,
  sourceSnapshot,
  targetSnapshot,
  comparison = compareCreatorSnapshots(sourceSnapshot, targetSnapshot)
}) {
  const direction = impactDirection(room, targetRelease);
  const evidence = normalizeEvidence(room.runtime_evidence);
  const runtimeActivityCount = Object.values(evidence).reduce((sum, count) => sum + count, 0);
  const assignedRoleIds = [...new Set((room.assigned_role_ids || []).map(String))].sort();
  const targetRoleIds = new Set((targetSnapshot.roles || []).map((role) => String(role.id)));
  const missingAssignedRoleIds = assignedRoleIds.filter((roleId) => !targetRoleIds.has(roleId));
  const hasStarted = Boolean(
    room.started_at
    || STARTED_ROOM_STATUSES.has(room.status)
    || runtimeActivityCount > 0
  );
  const blockers = [];
  const warnings = [];

  if (direction === "same") {
    blockers.push({
      code: "ROOM_RELEASE_ALREADY_BOUND",
      message: "房间已经绑定该发布版本"
    });
  }
  if (hasStarted) {
    blockers.push({
      code: "ROOM_RELEASE_CHANGE_AFTER_START",
      message: "房间已产生运行数据，必须新建房间或通过存档迁移，不能原地换版"
    });
  }
  if (missingAssignedRoleIds.length) {
    blockers.push({
      code: "TARGET_RELEASE_MISSING_ASSIGNED_ROLE",
      message: "目标版本缺少已经分配给玩家的角色",
      objectIds: missingAssignedRoleIds
    });
  }
  if (direction === "downgrade") {
    warnings.push({
      code: "TARGET_RELEASE_IS_OLDER",
      message: "目标版本早于当前绑定版本；确认后将按旧版内容运行"
    });
  }
  if (!targetRelease.is_latest) {
    warnings.push({
      code: "TARGET_RELEASE_NOT_LATEST",
      message: "目标版本不是当前最新发布版本"
    });
  }
  if (Number(targetRelease.source_content_revision) < Number(room.current_content_revision)) {
    warnings.push({
      code: "DRAFT_NEWER_THAN_TARGET",
      message: "当前作者草稿比目标发布版本更新；草稿改动不会进入本房间"
    });
  }
  if (Number(comparison.summary?.removed) > 0) {
    warnings.push({
      code: "TARGET_RELEASE_REMOVES_OBJECTS",
      message: `目标版本相对当前来源移除了 ${Number(comparison.summary.removed)} 个运行对象`
    });
  }

  return {
    direction,
    allowed: blockers.length === 0,
    fingerprint: impactFingerprint(room, targetRelease),
    comparison,
    runtimeImpact: {
      hasStarted,
      runtimeActivityCount,
      assignedRoleIds,
      missingAssignedRoleIds,
      evidence,
      blockers,
      warnings
    }
  };
}

function releaseSourceProjection(room, sourceRelease) {
  if (!sourceRelease) {
    return {
      mode: "live_draft",
      release: null,
      sourceRevision: Number(room.current_content_revision)
    };
  }
  return {
    mode: "release",
    release: projectWorldRelease(sourceRelease),
    sourceRevision: Number(sourceRelease.source_content_revision)
  };
}

export async function previewRoomReleaseImpact({ actorId, worldId, roomId, releaseId }) {
  return transaction(async (client) => {
    await configureRoomReleaseTransaction(client, { readOnly: true });
    const role = await findCreatorRoomActorRole({ worldId, actorId }, client);
    if (!role) throwErr("WORLD_ACCESS_DENIED");
    const room = await loadRoomReleaseBinding(client, { worldId, roomId });
    if (!room) throwErr("ROOM_NOT_FOUND");
    await assertRoomReleaseManager(client, { actorId, room, role });

    const targetRelease = await loadRoomReleaseSnapshot(client, { worldId, releaseId });
    if (!targetRelease) throwErr("WORLD_RELEASE_NOT_FOUND");
    const targetSnapshot = assertReleaseSnapshot(targetRelease);
    let sourceRelease = null;
    let sourceSnapshot;
    if (room.release_id) {
      sourceRelease = await loadRoomReleaseSnapshot(client, {
        worldId,
        releaseId: room.release_id
      });
      if (!sourceRelease) throwErr("WORLD_RELEASE_NOT_FOUND");
      sourceSnapshot = assertReleaseSnapshot(sourceRelease);
    } else {
      const candidate = await buildWorldReleaseCandidate(
        worldId,
        Number(room.current_content_revision),
        client
      );
      if (!candidate) throwErr("WORLD_NOT_FOUND");
      sourceSnapshot = candidate.snapshot;
    }
    const impact = evaluateRoomReleaseImpact({
      room,
      targetRelease,
      sourceSnapshot,
      targetSnapshot
    });
    return {
      roomId,
      currentBinding: projectRoomContentBinding(room, {
        runtimeSource: room.release_id ? "release_snapshot" : "live_draft"
      }),
      source: releaseSourceProjection(room, sourceRelease),
      targetRelease: projectWorldRelease(targetRelease),
      ...impact,
      generatedAt: new Date().toISOString()
    };
  });
}

export async function applyRoomReleaseChange({
  actorId,
  worldId,
  roomId,
  releaseId,
  expectedCurrentReleaseId,
  targetContentSha256,
  impactFingerprint: expectedImpactFingerprint
}) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureRoomReleaseTransaction(client);
    const role = await lockCreatorRoomActor(client, { worldId, actorId });
    if (!role) throwErr("WORLD_ACCESS_DENIED");
    const room = await loadRoomReleaseBinding(client, { worldId, roomId, lock: true });
    if (!room) throwErr("ROOM_NOT_FOUND");
    await assertRoomReleaseManager(client, { actorId, room, role, lock: true });
    room.assigned_role_ids = await lockRoomAssignedRoleIds(client, { roomId });
    if (String(room.release_id ?? "") !== String(expectedCurrentReleaseId ?? "")) {
      throwErr("ROOM_RELEASE_BINDING_CONFLICT");
    }

    const targetRelease = await loadRoomReleaseSnapshot(client, {
      worldId,
      releaseId,
      lock: true
    });
    if (!targetRelease) throwErr("WORLD_RELEASE_NOT_FOUND");
    if (targetRelease.content_sha256 !== targetContentSha256) {
      throwErr("ROOM_RELEASE_DIGEST_MISMATCH");
    }
    const targetSnapshot = assertReleaseSnapshot(targetRelease);
    // The full object diff is presentation evidence from preview. The apply
    // transaction only revalidates mutable blockers and the state-bound
    // fingerprint, keeping the room lock short.
    const impact = evaluateRoomReleaseImpact({
      room,
      targetRelease,
      targetSnapshot,
      comparison: APPLY_GUARD_COMPARISON
    });
    if (impact.fingerprint !== expectedImpactFingerprint) {
      throwErr("ROOM_RELEASE_IMPACT_STALE");
    }
    if (!impact.allowed) {
      const code = impact.runtimeImpact.blockers[0]?.code;
      if (code === "ROOM_RELEASE_ALREADY_BOUND" || code === "ROOM_RELEASE_CHANGE_AFTER_START") {
        throwErr(code);
      }
      throwErr("ROOM_RELEASE_IMPACT_BLOCKED", undefined, {
        blockers: impact.runtimeImpact.blockers
      });
    }

    const updated = await updateRoomReleaseBinding(client, { roomId, releaseId });
    await insertRoomReleaseAudit(client, {
      roomId,
      actorId,
      previousReleaseId: room.release_id,
      targetReleaseId: releaseId,
      direction: impact.direction,
      impactFingerprint: impact.fingerprint
    });
    queueEvent(roomId, "room.content_release_changed", {
      ...(room.release_id ? { previousReleaseId: room.release_id } : {}),
      releaseId,
      releaseNumber: Number(targetRelease.release_number),
      direction: impact.direction
    });
    return withRoomContentBinding(updated, { runtimeSource: "release_snapshot" });
  });
}
