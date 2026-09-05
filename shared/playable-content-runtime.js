/**
 * P7.1 Content Runtime + P7.2 permission/state overlay hooks.
 *
 * PlayableProject snapshot is immutable; all mutability lives in PlayableRuntimeState.
 * GAME execution lives in playable-mechanism-bridge.js (does not belong here).
 */

import {
  normalizePlayableProject,
} from "./playable-project-contracts.js";
import {
  permissionAllowsContent,
  permissionAllowsClue,
  staticAudienceAllows,
  roleHasPermission,
  normalizePermissionGrant,
} from "./playable-runtime-effects.js";
import { canonicalPlayableErrorCode } from "./playable-runtime-errors.js";
import {
  assertCanFinishPlayableSession,
  buildEndingSnapshot,
  normalizeEndingSettlement,
  canFinishPlayableSession,
} from "./playable-ending-settlement.js";

export const PLAYABLE_RUNTIME_SCHEMA_VERSION = 1;

export const RUNTIME_STATUSES = Object.freeze(["NOT_STARTED", "RUNNING", "FINISHED"]);
export const STAGE_RUNTIME_STATUSES = Object.freeze(["LOCKED", "ACTIVE", "COMPLETED"]);
export const PLACEMENT_RUNTIME_STATUSES = Object.freeze([
  "AVAILABLE_LATER",
  "NOT_IMPLEMENTED",
  "WAITING_HOST",
  "READY",
  "RUNNING",
  "SETTLED",
]);

export class PlayableContentRuntimeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PlayableContentRuntimeError";
    this.code = canonicalPlayableErrorCode(code);
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PlayableContentRuntimeError(code, message, details);
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nowIso(now) {
  return typeof now === "function" ? now() : now || new Date().toISOString();
}

export function normalizeStageRuntimeState(value = {}) {
  const src = record(value);
  return {
    stageId: String(src.stageId || ""),
    status: STAGE_RUNTIME_STATUSES.includes(src.status) ? src.status : "LOCKED",
    activatedAt: src.activatedAt != null ? String(src.activatedAt) : null,
    completedAt: src.completedAt != null ? String(src.completedAt) : null,
    releasedContentUnitIds: asArray(src.releasedContentUnitIds).map(String),
    releasedClueIds: asArray(src.releasedClueIds).map(String),
  };
}

export function normalizePlayableRuntimeState(value) {
  if (value == null) return null;
  const src = record(value);
  const snapshot = normalizePlayableProject(src.playableSnapshot);
  return {
    schemaVersion: PLAYABLE_RUNTIME_SCHEMA_VERSION,
    roomId: src.roomId != null ? String(src.roomId) : null,
    playableProjectId: String(src.playableProjectId || snapshot?.id || ""),
    playableProjectRevision: Number(src.playableProjectRevision) || Number(snapshot?.revision) || 0,
    playableFingerprint: String(src.playableFingerprint || snapshot?.source?.fingerprint || ""),
    playableSnapshot: snapshot,
    status: RUNTIME_STATUSES.includes(src.status) ? src.status : "NOT_STARTED",
    currentStageId: src.currentStageId != null ? String(src.currentStageId) : null,
    stageStates: asArray(src.stageStates).map(normalizeStageRuntimeState),
    releasedContentUnitIds: asArray(src.releasedContentUnitIds).map(String),
    releasedClueIds: asArray(src.releasedClueIds).map(String),
    roleAssignments: asArray(src.roleAssignments).map((r) => ({
      userId: String(record(r).userId || ""),
      playableRoleId: String(record(r).playableRoleId || ""),
      roleSlotId: record(r).roleSlotId != null ? String(record(r).roleSlotId) : undefined,
      assignedAt: record(r).assignedAt != null ? String(record(r).assignedAt) : null,
    })),
    readReceipts: asArray(src.readReceipts).map((r) => ({
      roleId: String(record(r).roleId || ""),
      contentUnitId: String(record(r).contentUnitId || ""),
      readAt: String(record(r).readAt || ""),
      userId: record(r).userId != null ? String(record(r).userId) : undefined,
    })),
    placementStatuses: asArray(src.placementStatuses).map((p) => ({
      placementId: String(record(p).placementId || ""),
      status: PLACEMENT_RUNTIME_STATUSES.includes(record(p).status)
        ? record(p).status
        : "NOT_IMPLEMENTED",
      note: record(p).note != null ? String(record(p).note) : undefined,
    })),
    permissionGrants: asArray(src.permissionGrants).map(normalizePermissionGrant),
    keyStates: record(src.keyStates),
    mechanismExecutions:
      src.mechanismExecutions && typeof src.mechanismExecutions === "object" && !Array.isArray(src.mechanismExecutions)
        ? src.mechanismExecutions
        : {},
    appliedEffectKeys: asArray(src.appliedEffectKeys).map(String),
    endingSettlement: src.endingSettlement
      ? normalizeEndingSettlement(src.endingSettlement)
      : null,
    endingSnapshot: src.endingSnapshot && typeof src.endingSnapshot === "object"
      ? src.endingSnapshot
      : null,
    startedAt: src.startedAt != null ? String(src.startedAt) : null,
    updatedAt: src.updatedAt != null ? String(src.updatedAt) : null,
    finishedAt: src.finishedAt != null ? String(src.finishedAt) : null,
    revision: Math.max(0, Math.trunc(Number(src.revision) || 0)),
  };
}

function deepFreezeClone(project) {
  return normalizePlayableProject(JSON.parse(JSON.stringify(project)));
}

function autoContentIdsForStage(snapshot, stageId) {
  return (snapshot.contentUnits || [])
    .filter((cu) => cu.stageId === stageId && cu.delivery === "AUTO_ON_STAGE")
    .map((cu) => cu.id);
}

function uniquePush(list, id) {
  if (!list.includes(id)) list.push(id);
}

function activatePlacementsForStage(state, stageId) {
  return (state.placementStatuses || []).map((ps) => {
    const placement = (state.playableSnapshot?.mechanismPlacements || []).find(
      (p) => p.id === ps.placementId,
    );
    if (!placement || placement.stageId !== stageId) return ps;
    const isM03 =
      placement.familyId === "M03" || String(placement.mechanismTemplateId || "").startsWith("M03");
    const isM09 =
      placement.familyId === "M09" || String(placement.mechanismTemplateId || "").startsWith("M09");
    if (isM09) {
      if (
        ps.status === "AVAILABLE_LATER" ||
        ps.status === "NOT_IMPLEMENTED" ||
        ps.status === "WAITING_HOST"
      ) {
        return { ...ps, status: "READY", note: "可开始最终指认" };
      }
      return ps;
    }
    if (isM03 && (ps.status === "AVAILABLE_LATER" || ps.status === "NOT_IMPLEMENTED" || ps.status === "WAITING_HOST")) {
      return { ...ps, status: "READY", note: "可开始竞价" };
    }
    return ps;
  });
}

/**
 * Create NOT_STARTED runtime with frozen snapshot (assignments optional until start).
 */
export function createPlayableRuntimeState({
  roomId = null,
  playableProject,
  roleAssignments = [],
  now = () => new Date().toISOString(),
} = {}) {
  const snapshot = deepFreezeClone(playableProject);
  if (!snapshot) fail("PLAYABLE_REQUIRED", "PlayableProject required");
  if (snapshot.status !== "READY") {
    fail("PLAYABLE_NOT_READY", `PlayableProject status is ${snapshot.status}, need READY`, {
      status: snapshot.status,
    });
  }
  const ts = nowIso(now);
  const stageStates = (snapshot.stages || []).map((st, i) =>
    normalizeStageRuntimeState({
      stageId: st.id,
      status: "LOCKED",
      releasedContentUnitIds: [],
      releasedClueIds: [],
    }),
  );
  const placementStatuses = (snapshot.mechanismPlacements || []).map((p) => {
    const isM03 = p.familyId === "M03" || String(p.mechanismTemplateId || "").startsWith("M03");
    const isM09 = p.familyId === "M09" || String(p.mechanismTemplateId || "").startsWith("M09");
    return {
      placementId: p.id,
      status: isM03 || isM09 ? "AVAILABLE_LATER" : "NOT_IMPLEMENTED",
      note: isM09
        ? "等待进入终幕后可启动"
        : isM03
          ? "等待进入本幕后可启动"
          : "玩法位置暂未桥接",
    };
  });

  return normalizePlayableRuntimeState({
    roomId,
    playableProjectId: snapshot.id,
    playableProjectRevision: snapshot.revision,
    playableFingerprint: snapshot.source?.fingerprint,
    playableSnapshot: snapshot,
    status: "NOT_STARTED",
    currentStageId: null,
    stageStates,
    releasedContentUnitIds: [],
    releasedClueIds: [],
    roleAssignments,
    readReceipts: [],
    placementStatuses,
    permissionGrants: [],
    keyStates: {},
    mechanismExecutions: {},
    appliedEffectKeys: [],
    endingSettlement: null,
    endingSnapshot: null,
    startedAt: null,
    updatedAt: ts,
    finishedAt: null,
    revision: 0,
  });
}

export function assignPlayableRole(runtime, { userId, playableRoleId, roleSlotId, now } = {}) {
  const state = normalizePlayableRuntimeState(runtime);
  if (!state) fail("RUNTIME_MISSING", "No runtime");
  if (state.status === "FINISHED") fail("RUNTIME_FINISHED", "Session already finished");
  const snapshot = state.playableSnapshot;
  const role = (snapshot.roles || []).find((r) => r.id === playableRoleId);
  if (!role) fail("UNKNOWN_ROLE", `Unknown playable role ${playableRoleId}`);
  if (role.type === "HOST") fail("HOST_NOT_ASSIGNABLE", "HOST role is not player-assignable");
  if (!role.playerAssignable) fail("ROLE_NOT_ASSIGNABLE", `Role ${playableRoleId} not assignable`);
  if (!userId) fail("USER_REQUIRED", "userId required");

  if (state.roleAssignments.some((a) => a.userId === userId && a.playableRoleId !== playableRoleId)) {
    fail("USER_ALREADY_ASSIGNED", `User ${userId} already has a role`);
  }
  if (state.roleAssignments.some((a) => a.playableRoleId === playableRoleId && a.userId !== userId)) {
    fail("ROLE_TAKEN", `Role ${playableRoleId} already assigned`);
  }

  const next = {
    ...state,
    roleAssignments: [
      ...state.roleAssignments.filter((a) => a.userId !== userId && a.playableRoleId !== playableRoleId),
      {
        userId,
        playableRoleId,
        roleSlotId,
        assignedAt: nowIso(now),
      },
    ],
    updatedAt: nowIso(now),
    revision: state.revision + 1,
  };
  return normalizePlayableRuntimeState(next);
}

function playerRoles(snapshot) {
  return (snapshot.roles || []).filter((r) => r.type === "PLAYER");
}

export function startPlayableSession(runtime, { now } = {}) {
  const state = normalizePlayableRuntimeState(runtime);
  if (!state) fail("RUNTIME_MISSING", "No runtime");
  if (state.status === "RUNNING") fail("ALREADY_STARTED", "Session already running");
  if (state.status === "FINISHED") fail("RUNTIME_FINISHED", "Session finished");
  const snapshot = state.playableSnapshot;
  if (snapshot.status !== "READY") fail("PLAYABLE_NOT_READY", "Snapshot not READY");

  const needed = playerRoles(snapshot);
  for (const role of needed) {
    if (!state.roleAssignments.some((a) => a.playableRoleId === role.id)) {
      fail("UNASSIGNED_ROLES", `Missing assignment for ${role.id}`, { roleId: role.id });
    }
  }

  const startId = snapshot.runtimeConfig?.startStageId || snapshot.stages[0]?.id;
  if (!startId) fail("MISSING_START_STAGE", "No start stage");

  const ts = nowIso(now);
  const autoIds = autoContentIdsForStage(snapshot, startId);
  const stageStates = state.stageStates.map((st) => {
    if (st.stageId !== startId) return { ...st, status: "LOCKED" };
    return {
      ...st,
      status: "ACTIVE",
      activatedAt: ts,
      releasedContentUnitIds: [...autoIds],
      releasedClueIds: [],
    };
  });

  return normalizePlayableRuntimeState({
    ...state,
    status: "RUNNING",
    currentStageId: startId,
    stageStates,
    releasedContentUnitIds: [...autoIds],
    releasedClueIds: [],
    placementStatuses: activatePlacementsForStage(state, startId),
    startedAt: ts,
    updatedAt: ts,
    revision: state.revision + 1,
  });
}

function requireRunning(state) {
  if (!state) fail("RUNTIME_MISSING", "No runtime");
  if (state.status !== "RUNNING") fail("NOT_RUNNING", `Runtime status is ${state.status}`);
  return state;
}

export function releaseContentUnit(runtime, { contentUnitId, now } = {}) {
  const state = requireRunning(normalizePlayableRuntimeState(runtime));
  const cu = state.playableSnapshot.contentUnits.find((c) => c.id === contentUnitId);
  if (!cu) fail("UNKNOWN_CONTENT", `Unknown content ${contentUnitId}`);
  if (cu.delivery === "CONDITION_UNLOCK") {
    fail("CONDITION_LOCKED", "CONDITION_UNLOCK content cannot be host-released in P7.1");
  }
  const active = state.stageStates.find((s) => s.stageId === state.currentStageId);
  if (cu.stageId !== state.currentStageId && active) {
    // allow host release only for current stage in V1
    fail("WRONG_STAGE", `Content ${contentUnitId} is not on active stage`);
  }

  const releasedContentUnitIds = [...state.releasedContentUnitIds];
  uniquePush(releasedContentUnitIds, contentUnitId);
  const stageStates = state.stageStates.map((st) => {
    if (st.stageId !== cu.stageId) return st;
    const ids = [...st.releasedContentUnitIds];
    uniquePush(ids, contentUnitId);
    return { ...st, releasedContentUnitIds: ids };
  });

  return normalizePlayableRuntimeState({
    ...state,
    releasedContentUnitIds,
    stageStates,
    updatedAt: nowIso(now),
    revision: state.revision + 1,
  });
}

export function releaseClue(runtime, { clueId, now } = {}) {
  const state = requireRunning(normalizePlayableRuntimeState(runtime));
  const clue = state.playableSnapshot.clues.find((c) => c.id === clueId);
  if (!clue) fail("UNKNOWN_CLUE", `Unknown clue ${clueId}`);
  if (clue.stageId !== state.currentStageId) {
    fail("WRONG_STAGE", `Clue ${clueId} is not on active stage`);
  }
  if (clue.delivery === "CONDITION_UNLOCK") {
    fail("CONDITION_LOCKED", "CONDITION_UNLOCK clue stays locked until P7.2");
  }

  const releasedClueIds = [...state.releasedClueIds];
  const already = releasedClueIds.includes(clueId);
  uniquePush(releasedClueIds, clueId);

  const releasedContentUnitIds = [...state.releasedContentUnitIds];
  uniquePush(releasedContentUnitIds, clue.contentUnitId);

  const stageStates = state.stageStates.map((st) => {
    if (st.stageId !== clue.stageId) return st;
    const cids = [...st.releasedClueIds];
    uniquePush(cids, clueId);
    const units = [...st.releasedContentUnitIds];
    uniquePush(units, clue.contentUnitId);
    return { ...st, releasedClueIds: cids, releasedContentUnitIds: units };
  });

  return normalizePlayableRuntimeState({
    ...state,
    releasedClueIds,
    releasedContentUnitIds,
    stageStates,
    updatedAt: nowIso(now),
    revision: already ? state.revision : state.revision + 1,
  });
}

export function advancePlayableStage(runtime, { now } = {}) {
  const state = requireRunning(normalizePlayableRuntimeState(runtime));
  const stages = state.playableSnapshot.stages || [];
  const idx = stages.findIndex((s) => s.id === state.currentStageId);
  if (idx < 0) fail("UNKNOWN_STAGE", "Current stage missing from snapshot");
  if (idx >= stages.length - 1) {
    fail("ALREADY_FINAL", "Already on final stage; use finishPlayableSession");
  }

  const ts = nowIso(now);
  const nextStage = stages[idx + 1];
  const autoIds = autoContentIdsForStage(state.playableSnapshot, nextStage.id);
  const releasedContentUnitIds = [...state.releasedContentUnitIds];
  for (const id of autoIds) uniquePush(releasedContentUnitIds, id);

  const stageStates = state.stageStates.map((st) => {
    if (st.stageId === state.currentStageId) {
      return { ...st, status: "COMPLETED", completedAt: ts };
    }
    if (st.stageId === nextStage.id) {
      return {
        ...st,
        status: "ACTIVE",
        activatedAt: ts,
        releasedContentUnitIds: [...autoIds],
        releasedClueIds: [],
      };
    }
    return st;
  });

  return normalizePlayableRuntimeState({
    ...state,
    currentStageId: nextStage.id,
    stageStates,
    releasedContentUnitIds,
    placementStatuses: activatePlacementsForStage(
      { ...state, placementStatuses: state.placementStatuses },
      nextStage.id,
    ),
    updatedAt: ts,
    revision: state.revision + 1,
  });
}

export function finishPlayableSession(runtime, { now } = {}) {
  const state = requireRunning(normalizePlayableRuntimeState(runtime));
  assertCanFinishPlayableSession(state);
  const ts = nowIso(now);
  const ending = normalizeEndingSettlement({
    ...state.endingSettlement,
    status: "CONFIRMED",
    confirmedAt: ts,
  });
  const stageStates = state.stageStates.map((st) => {
    if (st.stageId === state.currentStageId) {
      return { ...st, status: "COMPLETED", completedAt: ts };
    }
    return st;
  });
  const endingSnapshot = buildEndingSnapshot(
    { ...state, endingSettlement: ending },
    { ending, now: () => ts },
  );
  return normalizePlayableRuntimeState({
    ...state,
    status: "FINISHED",
    stageStates,
    endingSettlement: ending,
    endingSnapshot,
    finishedAt: ts,
    updatedAt: ts,
    revision: state.revision + 1,
  });
}

export function markContentRead(runtime, { roleId, contentUnitId, userId, now } = {}) {
  const state = requireRunning(normalizePlayableRuntimeState(runtime));
  const visible = resolveVisibleContent({ runtime: state, roleId });
  if (!visible.some((c) => c.id === contentUnitId)) {
    fail("CONTENT_NOT_VISIBLE", `Role ${roleId} cannot mark unread/invisible content`);
  }
  if (state.readReceipts.some((r) => r.roleId === roleId && r.contentUnitId === contentUnitId)) {
    return state; // idempotent
  }
  return normalizePlayableRuntimeState({
    ...state,
    readReceipts: [
      ...state.readReceipts,
      { roleId, contentUnitId, userId, readAt: nowIso(now) },
    ],
    updatedAt: nowIso(now),
    revision: state.revision + 1,
  });
}

function stageIsOpen(stageState) {
  return stageState && (stageState.status === "ACTIVE" || stageState.status === "COMPLETED");
}

/**
 * Backend authority: what a role may see RIGHT NOW.
 * P7.2: Static Audience OR Role Permission; still gated by stage / delivery / condition.
 * Never mutates ContentUnit.audience (compile contract stays immutable).
 */
export function resolveVisibleContent({ runtime, roleId }) {
  const state = normalizePlayableRuntimeState(runtime);
  if (!state?.playableSnapshot) return [];
  if (state.status === "NOT_STARTED") return [];

  const snapshot = state.playableSnapshot;
  const role = (snapshot.roles || []).find((r) => r.id === roleId);
  if (!role) return [];

  const released = new Set(state.releasedContentUnitIds);
  const openStages = new Set(
    state.stageStates.filter((s) => stageIsOpen(s)).map((s) => s.stageId),
  );

  const eligible = (snapshot.contentUnits || []).filter((cu) => {
    const byAudience = staticAudienceAllows(snapshot, roleId, cu);
    const byPermission = permissionAllowsContent(state, roleId, cu.id);
    return byAudience || byPermission;
  });

  return eligible.filter((cu) => {
    if (!openStages.has(cu.stageId)) return false;
    if (cu.delivery === "AUTO_ON_STAGE") {
      return released.has(cu.id) || openStages.has(cu.stageId);
    }
    if (cu.delivery === "HOST_RELEASE") {
      return released.has(cu.id);
    }
    if (cu.delivery === "CONDITION_UNLOCK") {
      if (released.has(cu.id)) return true;
      const cond = cu.unlockCondition;
      if (cond?.type === "PERMISSION" && cond.permissionId) {
        return roleHasPermission(state, roleId, cond.permissionId);
      }
      return false;
    }
    return false;
  });
}

/** Strict fetch: returns unit or throws / null for unauthorized */
export function fetchContentUnitForRole(runtime, { roleId, contentUnitId }) {
  const state = normalizePlayableRuntimeState(runtime);
  const unit = state?.playableSnapshot?.contentUnits?.find((c) => c.id === contentUnitId);
  if (!unit) {
    return { ok: false, code: "NOT_FOUND", unit: null };
  }
  const visible = resolveVisibleContent({ runtime: state, roleId });
  if (!visible.some((c) => c.id === contentUnitId)) {
    return { ok: false, code: "FORBIDDEN", unit: null };
  }
  return { ok: true, code: "OK", unit };
}

export function fetchClueForRole(runtime, { roleId, clueId }) {
  const state = normalizePlayableRuntimeState(runtime);
  const clue = state?.playableSnapshot?.clues?.find((c) => c.id === clueId);
  if (!clue) return { ok: false, code: "NOT_FOUND", clue: null, unit: null };
  const released = state.releasedClueIds.includes(clueId);
  const byPermission = permissionAllowsClue(state, roleId, clueId);
  if (!released && !byPermission) {
    return { ok: false, code: "FORBIDDEN", clue: null, unit: null };
  }
  const content = fetchContentUnitForRole(state, { roleId, contentUnitId: clue.contentUnitId });
  if (!content.ok) return { ok: false, code: content.code, clue: null, unit: null };
  return { ok: true, code: "OK", clue, unit: content.unit };
}

export function buildHostPlayableView(runtime) {
  const state = normalizePlayableRuntimeState(runtime);
  const snapshot = state.playableSnapshot;
  const current = snapshot?.stages?.find((s) => s.id === state.currentStageId);
  const stageState = state.stageStates.find((s) => s.stageId === state.currentStageId);
  const roleName = (id) => (snapshot?.roles || []).find((r) => r.id === id)?.name || id;
  const playerIds = (snapshot?.roles || []).filter((r) => r.type === "PLAYER").map((r) => r.id);
  const finishGate = canFinishPlayableSession(state);
  const ending = state.endingSettlement
    ? normalizeEndingSettlement(state.endingSettlement)
    : null;

  const releasableClues = (snapshot?.clues || [])
    .filter(
      (c) =>
        c.stageId === state.currentStageId &&
        c.delivery === "HOST_RELEASE" &&
        !state.releasedClueIds.includes(c.id),
    )
    .map((c) => ({ id: c.id, title: c.title }));

  const hostOnlyContent = (snapshot?.contentUnits || [])
    .filter(
      (c) =>
        c.audience.visibility === "HOST_ONLY" &&
        (stageState?.status === "ACTIVE" || stageState?.status === "COMPLETED") &&
        c.stageId === state.currentStageId,
    )
    .map((c) => ({ id: c.id, title: c.title }));

  const placements = (snapshot?.mechanismPlacements || [])
    .filter((p) => p.stageId === state.currentStageId)
    .map((p) => {
      const st = state.placementStatuses.find((x) => x.placementId === p.id);
      const exec = state.mechanismExecutions?.[p.id];
      const isM03 = p.familyId === "M03" || String(p.mechanismTemplateId || "").startsWith("M03");
      const isM09 = p.familyId === "M09" || String(p.mechanismTemplateId || "").startsWith("M09");
      const status = st?.status || "NOT_IMPLEMENTED";
      const ballots = record(record(exec?.gameState?.ballots).main);
      const submittedCount = Object.keys(ballots).length;
      const participantCount = playerIds.length;
      const allSubmitted = playerIds.every((rid) => Object.prototype.hasOwnProperty.call(ballots, rid));
      const canStart = (isM03 || isM09) && status === "READY" && state.status === "RUNNING";
      const canSettle = isM03
        ? status === "RUNNING"
        : isM09
          ? status === "RUNNING" && allSubmitted
          : false;
      const winnerLabel = exec?.winnerRoleId ? roleName(exec.winnerRoleId) : null;
      let outcomeSummary = null;
      if (status === "SETTLED") {
        if (isM09 && ending?.sourcePlacementId === p.id) {
          outcomeSummary = ending.hostSummary || ending.publicSummary;
        } else if (winnerLabel) {
          outcomeSummary = `赢家：${winnerLabel} · 获得仓房优先查验权`;
        } else {
          outcomeSummary = st?.note || "已结算";
        }
      } else if (status === "RUNNING") {
        outcomeSummary = isM09
          ? `等待玩家提交 · ${submittedCount} / ${participantCount}`
          : "进行中";
      } else if (status === "READY") {
        outcomeSummary = isM09 ? "可开始最终指认" : "可开始";
      } else {
        outcomeSummary = st?.note || null;
      }
      return {
        placementId: p.id,
        id: p.id,
        title: p.title,
        familyId: p.familyId,
        status,
        note: st?.note,
        canStart,
        canSettle,
        canBid: false,
        submittedCount: isM09 ? submittedCount : undefined,
        participantCount: isM09 ? participantCount : undefined,
        winnerLabel,
        outcomeSummary,
        startLabel: isM09 ? "开始最终指认" : "开始竞价",
        settleLabel: isM09 ? "结算最终指认" : "结算竞价",
      };
    });

  const playerRoles = (snapshot?.roles || [])
    .filter((r) => r.type === "PLAYER")
    .map((role) => {
      const a = state.roleAssignments.find((x) => x.playableRoleId === role.id);
      const roleUnits = a
        ? resolveVisibleContent({ runtime: state, roleId: role.id })
        : [];
      const readIds = new Set(
        state.readReceipts.filter((r) => r.roleId === role.id).map((r) => r.contentUnitId),
      );
      return {
        roleId: role.id,
        name: role.name,
        assignedUserId: a?.userId || null,
        assigned: Boolean(a),
        read: roleUnits.filter((u) => readIds.has(u.id)).length,
        visible: roleUnits.length,
      };
    });

  return {
    status: state.status,
    currentStageId: state.currentStageId,
    currentStageTitle: current?.title,
    stageIndex: (snapshot?.stages || []).findIndex((s) => s.id === state.currentStageId) + 1,
    stageCount: snapshot?.stages?.length || 0,
    playerRoles,
    roleAssignments: state.roleAssignments.map((a) => ({
      userId: a.userId,
      playableRoleId: a.playableRoleId,
    })),
    releasableClues,
    hostOnlyContent,
    placements,
    canConfirmEnding: finishGate.ok === true,
    endingSummary: ending
      ? {
          status: ending.status,
          publicSummary: ending.publicSummary,
          hostSummary: ending.hostSummary,
          result: {
            winningOptionId: ending.result.winningOptionId,
            correctOptionId: ending.result.correctOptionId,
            isCorrect: ending.result.isCorrect,
            outcomeType: ending.result.outcomeType,
            voteSummary: ending.result.voteSummary,
          },
        }
      : null,
    playableProjectId: state.playableProjectId,
    playableFingerprint: state.playableFingerprint,
    revision: state.revision,
  };
}

export function buildPlayerPlayableView(runtime, { playableRoleId }) {
  const state = normalizePlayableRuntimeState(runtime);
  const snapshot = state.playableSnapshot;
  const role = (snapshot?.roles || []).find((r) => r.id === playableRoleId);
  const current = snapshot?.stages?.find((s) => s.id === state.currentStageId);
  const units = resolveVisibleContent({ runtime: state, roleId: playableRoleId });
  const texts = units
    .filter((u) => u.type === "TEXT" || u.type === "SYSTEM" || u.type === "REVEAL")
    .map((u) => ({ id: u.id, title: u.title, content: u.content, type: u.type, stageId: u.stageId }));
  const clues = (snapshot?.clues || [])
    .map((c) => {
      const got = fetchClueForRole(state, { roleId: playableRoleId, clueId: c.id });
      return got.ok
        ? {
            clueId: c.id,
            title: c.title,
            content: got.unit?.content || "",
          }
        : null;
    })
    .filter(Boolean);

  const ending = state.endingSettlement
    ? normalizeEndingSettlement(state.endingSettlement)
    : null;
  const roleNameFn = (id) => (snapshot?.roles || []).find((r) => r.id === id)?.name || id;

  const placements = (snapshot?.mechanismPlacements || [])
    .filter((p) => p.stageId === state.currentStageId)
    .map((p) => {
      const st = state.placementStatuses.find((x) => x.placementId === p.id);
      const exec = state.mechanismExecutions?.[p.id];
      const status = st?.status || "WAITING_HOST";
      const isM03 = p.familyId === "M03" || String(p.mechanismTemplateId || "").startsWith("M03");
      const isM09 = p.familyId === "M09" || String(p.mechanismTemplateId || "").startsWith("M09");
      const isWinner = exec?.winnerRoleId === playableRoleId;
      const cfg = record(p.runtimeConfig);
      const candidates = asArray(cfg.candidates).length
        ? asArray(cfg.candidates).map(String)
        : (snapshot?.roles || []).filter((r) => r.type === "PLAYER").map((r) => r.id);
      const ballots = record(record(exec?.gameState?.ballots).main);
      const myBallot = ballots[playableRoleId];
      const myOptionId = myBallot && !myBallot.abstain ? String(myBallot.choice || "") : null;
      const canSubmit = isM09 && status === "RUNNING" && state.status === "RUNNING";
      const canChange = canSubmit && Boolean(myOptionId); // M09-1 allow_revise
      let note = st?.note || "等待主持开始";
      if (status === "RUNNING") {
        note = isM09
          ? myOptionId
            ? `已提交：${roleNameFn(myOptionId)}`
            : "请选择你认为的真凶"
          : "竞价进行中，请出价";
      } else if (status === "SETTLED") {
        note = isM09
          ? ending?.publicSummary || "最终指认已结算"
          : isWinner
            ? "已结算 · 你是赢家"
            : "已结算";
      } else if (status === "READY") {
        note = "等待主持开始";
      }
      return {
        placementId: p.id,
        id: p.id,
        title: p.title,
        familyId: p.familyId,
        status,
        canBid: isM03 && status === "RUNNING",
        canSubmit,
        canChange,
        options: isM09
          ? candidates.map((id) => ({ optionId: id, label: roleNameFn(id) }))
          : undefined,
        mySubmission: myOptionId
          ? { optionId: myOptionId, label: roleNameFn(myOptionId) }
          : null,
        note,
        outcomeSummary: status === "SETTLED"
          ? isM09
            ? ending?.publicSummary || null
            : isWinner
              ? "你获得了仓房优先查验权"
              : null
          : null,
      };
    });

  return {
    status: state.status,
    roleId: playableRoleId,
    roleName: role?.name,
    currentStageId: state.currentStageId,
    currentStageTitle: current?.title,
    contentUnits: texts,
    clues,
    placements,
    endingSummary:
      ending && (state.status === "FINISHED" || ending.status === "PENDING_CONFIRMATION")
        ? {
            status: ending.status,
            publicSummary: ending.publicSummary,
            result: {
              winningOptionId: ending.result.winningOptionId,
              isCorrect: ending.result.isCorrect,
              outcomeType: ending.result.outcomeType,
            },
          }
        : null,
    readReceipts: state.readReceipts
      .filter((r) => r.roleId === playableRoleId)
      .map((r) => ({ contentUnitId: r.contentUnitId, readAt: r.readAt })),
  };
}

/** Public runtime summary — never expose snapshot / mechanismExecutions to UI. */
export function buildRuntimePublicSummary(runtime) {
  const state = normalizePlayableRuntimeState(runtime);
  if (!state) return null;
  return {
    status: state.status,
    currentStageId: state.currentStageId,
    playableProjectId: state.playableProjectId,
    playableFingerprint: state.playableFingerprint,
    revision: state.revision,
  };
}

export function roleIdForUser(runtime, userId) {
  const state = normalizePlayableRuntimeState(runtime);
  return state?.roleAssignments?.find((a) => a.userId === userId)?.playableRoleId || null;
}

export function userIdForRole(runtime, playableRoleId) {
  const state = normalizePlayableRuntimeState(runtime);
  return state?.roleAssignments?.find((a) => a.playableRoleId === playableRoleId)?.userId || null;
}
