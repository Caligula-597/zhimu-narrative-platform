/**
 * P7.1 Content Runtime — pure StageRuntime + visibility (no GAME execution).
 *
 * PlayableProject snapshot is immutable; all mutability lives in PlayableRuntimeState.
 */

import {
  normalizePlayableProject,
  listContentUnitsForRole,
} from "./playable-project-contracts.js";

export const PLAYABLE_RUNTIME_SCHEMA_VERSION = 1;

export const RUNTIME_STATUSES = Object.freeze(["NOT_STARTED", "RUNNING", "FINISHED"]);
export const STAGE_RUNTIME_STATUSES = Object.freeze(["LOCKED", "ACTIVE", "COMPLETED"]);
export const PLACEMENT_RUNTIME_STATUSES = Object.freeze([
  "AVAILABLE_LATER",
  "NOT_IMPLEMENTED",
  "WAITING_HOST",
]);

export class PlayableContentRuntimeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PlayableContentRuntimeError";
    this.code = code;
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
  const placementStatuses = (snapshot.mechanismPlacements || []).map((p) => ({
    placementId: p.id,
    status: "NOT_IMPLEMENTED",
    note: "P7.1：玩法位置可见，但 Content Runtime 不执行 GAME（P7.2/P7.3）",
  }));

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
    updatedAt: ts,
    revision: state.revision + 1,
  });
}

export function finishPlayableSession(runtime, { now } = {}) {
  const state = requireRunning(normalizePlayableRuntimeState(runtime));
  const ts = nowIso(now);
  const stageStates = state.stageStates.map((st) => {
    if (st.stageId === state.currentStageId) {
      return { ...st, status: "COMPLETED", completedAt: ts };
    }
    return st;
  });
  return normalizePlayableRuntimeState({
    ...state,
    status: "FINISHED",
    stageStates,
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

  const candidates = listContentUnitsForRole(snapshot, roleId);
  return candidates.filter((cu) => {
    if (!openStages.has(cu.stageId)) return false;
    if (cu.delivery === "AUTO_ON_STAGE") {
      return released.has(cu.id) || openStages.has(cu.stageId);
    }
    if (cu.delivery === "HOST_RELEASE") {
      return released.has(cu.id);
    }
    if (cu.delivery === "CONDITION_UNLOCK") {
      return released.has(cu.id); // P7.1: never auto; stays locked unless somehow released (should not)
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
  if (!state.releasedClueIds.includes(clueId)) {
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
  const releasableClues = (snapshot?.clues || []).filter(
    (c) =>
      c.stageId === state.currentStageId &&
      c.delivery === "HOST_RELEASE" &&
      !state.releasedClueIds.includes(c.id),
  );
  const releasableContent = (snapshot?.contentUnits || []).filter(
    (c) =>
      c.stageId === state.currentStageId &&
      c.delivery === "HOST_RELEASE" &&
      !state.releasedContentUnitIds.includes(c.id) &&
      c.audience.visibility !== "HOST_ONLY",
  );
  const hostOnly = (snapshot?.contentUnits || []).filter(
    (c) =>
      c.audience.visibility === "HOST_ONLY" &&
      (stageState?.status === "ACTIVE" || stageState?.status === "COMPLETED") &&
      c.stageId === state.currentStageId,
  );
  const placements = (snapshot?.mechanismPlacements || [])
    .filter((p) => p.stageId === state.currentStageId)
    .map((p) => {
      const st = state.placementStatuses.find((x) => x.placementId === p.id);
      return {
        id: p.id,
        title: p.title,
        mechanismTemplateId: p.mechanismTemplateId,
        status: st?.status || "NOT_IMPLEMENTED",
        note: st?.note,
        runnable: false,
      };
    });

  const readByRole = {};
  for (const a of state.roleAssignments) {
    const roleUnits = resolveVisibleContent({ runtime: state, roleId: a.playableRoleId });
    const readIds = new Set(
      state.readReceipts.filter((r) => r.roleId === a.playableRoleId).map((r) => r.contentUnitId),
    );
    readByRole[a.playableRoleId] = {
      userId: a.userId,
      visible: roleUnits.length,
      read: roleUnits.filter((u) => readIds.has(u.id)).length,
    };
  }

  return {
    status: state.status,
    currentStageId: state.currentStageId,
    currentStageTitle: current?.title,
    stageIndex: (snapshot?.stages || []).findIndex((s) => s.id === state.currentStageId) + 1,
    stageCount: snapshot?.stages?.length || 0,
    stageStates: state.stageStates,
    roleAssignments: state.roleAssignments,
    readByRole,
    releasableClues,
    releasableContent,
    hostOnlyContent: hostOnly,
    placements,
    releasedClueIds: state.releasedClueIds,
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
  const texts = units.filter((u) => u.type === "TEXT" || u.type === "SYSTEM" || u.type === "REVEAL");
  const clues = (snapshot?.clues || [])
    .filter((c) => state.releasedClueIds.includes(c.id))
    .map((c) => {
      const got = fetchClueForRole(state, { roleId: playableRoleId, clueId: c.id });
      return got.ok ? { clue: c, content: got.unit } : null;
    })
    .filter(Boolean);

  const placements = (snapshot?.mechanismPlacements || [])
    .filter((p) => p.stageId === state.currentStageId)
    .map((p) => ({
      id: p.id,
      title: p.title,
      status: "WAITING_HOST",
      note: "等待主持开始（P7.2 后可运行）",
      runnable: false,
    }));

  return {
    status: state.status,
    roleId: playableRoleId,
    roleName: role?.name,
    currentStageId: state.currentStageId,
    currentStageTitle: current?.title,
    contentUnits: texts,
    clues,
    placements,
    readReceipts: state.readReceipts.filter((r) => r.roleId === playableRoleId),
  };
}

export function roleIdForUser(runtime, userId) {
  const state = normalizePlayableRuntimeState(runtime);
  return state?.roleAssignments?.find((a) => a.userId === userId)?.playableRoleId || null;
}
