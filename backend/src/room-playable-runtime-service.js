/**
 * P7.1/P7.2 Content Runtime service — binds READY PlayableProject to existing rooms.
 */

import { transaction } from "./db.js";
import { loadPlayableProject } from "./playable-project-service.js";
import {
  findRoomPlayableRuntime,
  upsertRoomPlayableRuntime,
} from "./repositories/room-playable-runtime-repository.js";
import {
  PlayableContentRuntimeError,
  createPlayableRuntimeState,
  assignPlayableRole,
  startPlayableSession,
  releaseContentUnit,
  releaseClue,
  advancePlayableStage,
  finishPlayableSession,
  markContentRead,
  resolveVisibleContent,
  fetchContentUnitForRole,
  fetchClueForRole,
  buildHostPlayableView,
  buildPlayerPlayableView,
  roleIdForUser,
  normalizePlayableRuntimeState,
} from "../../shared/playable-content-runtime.js";
import {
  startPlacementMechanism,
  bidPlacementMechanism,
  settlePlacementMechanism,
} from "../../shared/playable-mechanism-bridge.js";
import { compileWarehouseSixFixture } from "../../shared/playable-project-compiler.js";

function mapError(error) {
  if (error instanceof PlayableContentRuntimeError) return error;
  return error;
}

async function requireRoom(client, roomId) {
  const result = await client.query(`SELECT id, world_id FROM rooms WHERE id = $1`, [roomId]);
  if (!result.rows[0]) {
    const err = new Error("ROOM_NOT_FOUND");
    err.code = "ROOM_NOT_FOUND";
    throw err;
  }
  return result.rows[0];
}

async function loadOrThrow(roomId, { client = null, forUpdate = false } = {}) {
  const runtime = await findRoomPlayableRuntime(roomId, { client, forUpdate });
  if (!runtime) {
    const err = new Error("PLAYABLE_RUNTIME_MISSING");
    err.code = "PLAYABLE_RUNTIME_MISSING";
    throw err;
  }
  return runtime;
}

export async function getRoomPlayableRuntime(roomId) {
  return findRoomPlayableRuntime(roomId);
}

export async function getHostPlayableRuntime(roomId) {
  const runtime = await loadOrThrow(roomId);
  return {
    runtime,
    view: buildHostPlayableView(runtime),
  };
}

export async function getPlayerPlayableRuntime(roomId, userId) {
  const runtime = await loadOrThrow(roomId);
  const playableRoleId = roleIdForUser(runtime, userId);
  if (!playableRoleId) {
    const err = new Error("ROLE_NOT_ASSIGNED");
    err.code = "ROLE_NOT_ASSIGNED";
    throw err;
  }
  return {
    runtime: {
      status: runtime.status,
      currentStageId: runtime.currentStageId,
      playableProjectId: runtime.playableProjectId,
      playableFingerprint: runtime.playableFingerprint,
      revision: runtime.revision,
    },
    view: buildPlayerPlayableView(runtime, { playableRoleId }),
  };
}

/**
 * Bind current world PlayableProject (or warehouse fixture) into room as NOT_STARTED snapshot.
 */
export async function initializeRoomPlayableRuntime({
  roomId,
  actorId,
  useFixtureFallback = true,
} = {}) {
  return transaction(async (client) => {
    const room = await requireRoom(client, roomId);
    const existing = await findRoomPlayableRuntime(roomId, { client, forUpdate: true });
    if (existing && existing.status === "RUNNING") {
      const err = new Error("ALREADY_RUNNING");
      err.code = "ALREADY_RUNNING";
      throw err;
    }

    let project = null;
    const loaded = await loadPlayableProject(room.world_id);
    if (loaded?.project?.status === "READY") {
      project = loaded.project;
    } else if (useFixtureFallback) {
      project = compileWarehouseSixFixture({
        worldId: room.world_id,
        now: () => new Date().toISOString(),
      });
    }
    if (!project || project.status !== "READY") {
      const err = new Error("PLAYABLE_NOT_READY");
      err.code = "PLAYABLE_NOT_READY";
      throw err;
    }

    const runtime = createPlayableRuntimeState({
      roomId,
      playableProject: project,
      roleAssignments: existing?.roleAssignments || [],
    });
    const saved = await upsertRoomPlayableRuntime(client, runtime, actorId);
    return { runtime: saved, view: buildHostPlayableView(saved) };
  });
}

export async function assignRoomPlayableRole({ roomId, actorId, userId, playableRoleId, roleSlotId }) {
  try {
    return await transaction(async (client) => {
      await requireRoom(client, roomId);
      const current = await loadOrThrow(roomId, { client, forUpdate: true });
      const next = assignPlayableRole(current, {
        userId: userId || actorId,
        playableRoleId,
        roleSlotId,
      });
      const saved = await upsertRoomPlayableRuntime(client, next, actorId);
      return { runtime: saved, view: buildHostPlayableView(saved) };
    });
  } catch (error) {
    throw mapError(error);
  }
}

export async function startRoomPlayableSession({ roomId, actorId }) {
  try {
    return await transaction(async (client) => {
      await requireRoom(client, roomId);
      const current = await loadOrThrow(roomId, { client, forUpdate: true });
      const next = startPlayableSession(current);
      const saved = await upsertRoomPlayableRuntime(client, next, actorId);
      return { runtime: saved, view: buildHostPlayableView(saved) };
    });
  } catch (error) {
    throw mapError(error);
  }
}

export async function releaseRoomPlayableContent({ roomId, actorId, contentUnitId }) {
  try {
    return await transaction(async (client) => {
      await requireRoom(client, roomId);
      const next = releaseContentUnit(await loadOrThrow(roomId, { client, forUpdate: true }), {
        contentUnitId,
      });
      const saved = await upsertRoomPlayableRuntime(client, next, actorId);
      return { runtime: saved, view: buildHostPlayableView(saved) };
    });
  } catch (error) {
    throw mapError(error);
  }
}

export async function releaseRoomPlayableClue({ roomId, actorId, clueId }) {
  try {
    return await transaction(async (client) => {
      await requireRoom(client, roomId);
      const next = releaseClue(await loadOrThrow(roomId, { client, forUpdate: true }), { clueId });
      const saved = await upsertRoomPlayableRuntime(client, next, actorId);
      return { runtime: saved, view: buildHostPlayableView(saved) };
    });
  } catch (error) {
    throw mapError(error);
  }
}

export async function advanceRoomPlayableStage({ roomId, actorId }) {
  try {
    return await transaction(async (client) => {
      await requireRoom(client, roomId);
      const next = advancePlayableStage(await loadOrThrow(roomId, { client, forUpdate: true }));
      const saved = await upsertRoomPlayableRuntime(client, next, actorId);
      return { runtime: saved, view: buildHostPlayableView(saved) };
    });
  } catch (error) {
    throw mapError(error);
  }
}

export async function finishRoomPlayableSession({ roomId, actorId }) {
  try {
    return await transaction(async (client) => {
      await requireRoom(client, roomId);
      const next = finishPlayableSession(await loadOrThrow(roomId, { client, forUpdate: true }));
      const saved = await upsertRoomPlayableRuntime(client, next, actorId);
      return { runtime: saved, view: buildHostPlayableView(saved) };
    });
  } catch (error) {
    throw mapError(error);
  }
}

export async function markRoomPlayableContentRead({ roomId, userId, contentUnitId }) {
  try {
    return await transaction(async (client) => {
      await requireRoom(client, roomId);
      const current = await loadOrThrow(roomId, { client, forUpdate: true });
      const playableRoleId = roleIdForUser(current, userId);
      if (!playableRoleId) {
        const err = new Error("ROLE_NOT_ASSIGNED");
        err.code = "ROLE_NOT_ASSIGNED";
        throw err;
      }
      const next = markContentRead(current, {
        roleId: playableRoleId,
        contentUnitId,
        userId,
      });
      const saved = await upsertRoomPlayableRuntime(client, next, userId);
      return {
        runtime: {
          status: saved.status,
          revision: saved.revision,
        },
        view: buildPlayerPlayableView(saved, { playableRoleId }),
      };
    });
  } catch (error) {
    throw mapError(error);
  }
}

export async function getPlayerPlayableContentUnit({ roomId, userId, contentUnitId }) {
  const runtime = await loadOrThrow(roomId);
  const playableRoleId = roleIdForUser(runtime, userId);
  if (!playableRoleId) {
    const err = new Error("ROLE_NOT_ASSIGNED");
    err.code = "ROLE_NOT_ASSIGNED";
    throw err;
  }
  const result = fetchContentUnitForRole(runtime, {
    roleId: playableRoleId,
    contentUnitId,
  });
  if (!result.ok) {
    const err = new Error(result.code);
    err.code = result.code === "NOT_FOUND" ? "CONTENT_NOT_FOUND" : "CONTENT_FORBIDDEN";
    throw err;
  }
  return { contentUnit: result.unit };
}

export async function getPlayerPlayableClue({ roomId, userId, clueId }) {
  const runtime = await loadOrThrow(roomId);
  const playableRoleId = roleIdForUser(runtime, userId);
  if (!playableRoleId) {
    const err = new Error("ROLE_NOT_ASSIGNED");
    err.code = "ROLE_NOT_ASSIGNED";
    throw err;
  }
  const result = fetchClueForRole(runtime, { roleId: playableRoleId, clueId });
  if (!result.ok) {
    const err = new Error(result.code);
    err.code = result.code === "NOT_FOUND" ? "CLUE_NOT_FOUND" : "CLUE_FORBIDDEN";
    throw err;
  }
  return { clue: result.clue, contentUnit: result.unit };
}

export async function startRoomPlayableMechanism({ roomId, actorId, placementId }) {
  try {
    return await transaction(async (client) => {
      await requireRoom(client, roomId);
      const next = startPlacementMechanism(await loadOrThrow(roomId, { client, forUpdate: true }), {
        placementId,
      });
      const saved = await upsertRoomPlayableRuntime(client, next, actorId);
      return { runtime: saved, view: buildHostPlayableView(saved) };
    });
  } catch (error) {
    throw mapError(error);
  }
}

export async function settleRoomPlayableMechanism({ roomId, actorId, placementId }) {
  try {
    return await transaction(async (client) => {
      await requireRoom(client, roomId);
      const next = settlePlacementMechanism(await loadOrThrow(roomId, { client, forUpdate: true }), {
        placementId,
      });
      const saved = await upsertRoomPlayableRuntime(client, next, actorId);
      return { runtime: saved, view: buildHostPlayableView(saved) };
    });
  } catch (error) {
    throw mapError(error);
  }
}

export async function bidRoomPlayableMechanism({ roomId, userId, placementId, amount, bidId }) {
  try {
    return await transaction(async (client) => {
      await requireRoom(client, roomId);
      const current = await loadOrThrow(roomId, { client, forUpdate: true });
      const playableRoleId = roleIdForUser(current, userId);
      if (!playableRoleId) {
        const err = new Error("ROLE_NOT_ASSIGNED");
        err.code = "ROLE_NOT_ASSIGNED";
        throw err;
      }
      const next = bidPlacementMechanism(current, {
        placementId,
        playableRoleId,
        amount,
        bidId,
      });
      const saved = await upsertRoomPlayableRuntime(client, next, userId);
      return {
        runtime: { status: saved.status, revision: saved.revision },
        view: buildPlayerPlayableView(saved, { playableRoleId }),
      };
    });
  } catch (error) {
    throw mapError(error);
  }
}

export {
  resolveVisibleContent,
  fetchContentUnitForRole,
  normalizePlayableRuntimeState,
};
