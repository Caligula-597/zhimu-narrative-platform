import { httpError, throwErr } from "./api-errors.js";
import { rewardFirstRecap } from "./credits.js";
import { transaction } from "./db.js";
import { filterRecapForPlayer, summarizeRecap } from "./recap-projection-service.js";
import {
  configureRecapTransaction,
  countRoomRecaps,
  findLatestRoomRecap,
  findRoomRecap,
  insertRoomRecap,
  listRoomRecapRows,
  lockActiveRecapMembership,
  lockRecapRoom,
  readRecapWorldEditorRole,
  tryLockRecapGeneration,
  upsertRecapHostMembership
} from "./repositories/recap-repository.js";
import { requireRoomRole } from "./routes/route-guards.js";
import { buildRoomRecapSnapshot } from "./routes/recap-helpers.js";

export const RECAP_LIST_LIMIT = 100;
export const RECAP_MAX_PER_ROOM = 100;
export const RECAP_MAX_SNAPSHOT_BYTES = 16 * 1024 * 1024;

function isHostMembership(membership) {
  return ["host", "cohost"].includes(membership?.member_type);
}

function requireHostMembership(membership) {
  if (!isHostMembership(membership)) throwErr("HOST_ROLE_REQUIRED");
  return membership;
}

async function lockMembershipForCreate(client, { actorId, roomId }) {
  const room = await lockRecapRoom(client, roomId);
  if (!room) throwErr("ROOM_NOT_FOUND");

  const membership = await lockActiveRecapMembership(client, { roomId, actorId });
  if (membership) return membership;

  if (room.host_user_id === actorId) {
    return upsertRecapHostMembership(client, { roomId, actorId });
  }
  const editorRole = await readRecapWorldEditorRole(client, { worldId: room.world_id, actorId });
  if (editorRole) return upsertRecapHostMembership(client, { roomId, actorId });
  throwErr("ROOM_MEMBERSHIP_REQUIRED");
}

function mapRecapListRow(row) {
  return {
    id: row.id,
    label: row.label,
    description: row.description ?? "",
    created_at: row.created_at,
    created_by_name: row.created_by_name,
    summary: summarizeRecap({ stats: row.stats ?? {} })
  };
}

function projectRecap(row, membership) {
  const isHost = isHostMembership(membership);
  if (!isHost && !membership?.role_slot_id) {
    throwErr("PLAYER_ROLE_REQUIRED", "Player role selection required");
  }
  const snapshot = isHost
    ? { ...row.snapshot, perspective: "host" }
    : filterRecapForPlayer(row.snapshot, membership.role_slot_id);
  return {
    id: row.id,
    label: row.label,
    description: row.snapshot?.description ?? "",
    created_at: row.created_at,
    created_by_name: row.created_by_name,
    perspective: isHost ? "host" : "postgame",
    snapshot,
    summary: summarizeRecap(row.snapshot)
  };
}

export function assertRecapSnapshotSize(snapshot, maxBytes = RECAP_MAX_SNAPSHOT_BYTES) {
  const snapshotJson = JSON.stringify(snapshot);
  const byteSize = Buffer.byteLength(snapshotJson, "utf8");
  if (byteSize > maxBytes) {
    throwErr("RECAP_TOO_LARGE", undefined, { byteSize, maxBytes });
  }
  return snapshotJson;
}

export function normalizeRecapGenerationError(error) {
  if (["40P01", "55P03"].includes(error?.code)) {
    return httpError(409, "Recap generation is busy; retry shortly", "RECAP_GENERATION_IN_PROGRESS");
  }
  if (error?.code === "57014") {
    return httpError(503, "Recap generation exceeded its safe execution window", "RECAP_GENERATION_TIMEOUT");
  }
  return error;
}

export async function listRoomRecaps({ actorId, roomId }) {
  requireHostMembership(await requireRoomRole(actorId, roomId));
  const rows = await listRoomRecapRows({ roomId, actorId, limit: RECAP_LIST_LIMIT });
  return rows.map(mapRecapListRow);
}

export async function getRoomRecap({ actorId, roomId, recapId }) {
  const membership = await requireRoomRole(actorId, roomId);
  const row = await findRoomRecap({ roomId, recapId, actorId });
  if (!row) throwErr("RECAP_NOT_FOUND");
  return projectRecap(row, membership);
}

export async function getLatestRoomRecap({ actorId, roomId }) {
  const membership = await requireRoomRole(actorId, roomId);
  const row = await findLatestRoomRecap({ roomId, actorId });
  if (!row) throwErr("RECAP_NOT_GENERATED");
  return projectRecap(row, membership);
}

export async function createRoomRecap({
  actorId,
  roomId,
  title,
  description = "",
  logger,
  rewardRecap = rewardFirstRecap
}) {
  const normalizedTitle = String(title ?? "").trim();
  if (!normalizedTitle) throwErr("RECAP_TITLE_REQUIRED");

  let row;
  try {
    row = await transaction(async (client) => {
      await configureRecapTransaction(client);
      if (!await tryLockRecapGeneration(client, roomId)) {
        throwErr("RECAP_GENERATION_IN_PROGRESS");
      }
      requireHostMembership(await lockMembershipForCreate(client, { actorId, roomId }));
      const recapCount = await countRoomRecaps(client, roomId);
      if (recapCount >= RECAP_MAX_PER_ROOM) {
        throwErr("RECAP_LIMIT_REACHED", undefined, { limit: RECAP_MAX_PER_ROOM });
      }

      const snapshot = await buildRoomRecapSnapshot(client.query.bind(client), roomId);
      if (!snapshot) throwErr("ROOM_NOT_FOUND");
      snapshot.description = String(description ?? "").trim();
      const snapshotJson = assertRecapSnapshotSize(snapshot);
      return insertRoomRecap(client, {
        roomId,
        actorId,
        title: normalizedTitle,
        snapshotJson
      });
    });
  } catch (error) {
    throw normalizeRecapGenerationError(error);
  }

  let creditReward = null;
  try {
    creditReward = await rewardRecap(actorId, row.id);
  } catch (error) {
    logger?.warn?.({ err: error, actorId, recapId: row.id }, "recap credit reward deferred");
  }

  return {
    ...projectRecap(row, { member_type: "host", role_slot_id: null }),
    creditReward: creditReward
      ? {
          granted: true,
          amount: creditReward.amount,
          note: "首场复盘奖励已记入织幕积分（界面开放后可查看）"
        }
      : null
  };
}
