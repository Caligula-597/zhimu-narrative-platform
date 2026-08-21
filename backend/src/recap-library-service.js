import { throwErr } from "./api-errors.js";
import { transaction } from "./db.js";
import { filterRecapForPlayer, summarizeRecap } from "./recap-projection-service.js";
import {
  ROOM_EXPERIENCE_STATE_KINDS,
  normalizeRoomExperienceIdentity,
  normalizeRoomExperiencePayload,
} from "./room-experience-state.js";
import {
  findRoomExperienceState,
  insertRoomExperienceState,
  updateRoomExperienceState,
} from "./repositories/room-experience-state-repository.js";
import {
  findAccountRecapContext,
  listAccountRecapRows,
} from "./repositories/recap-library-repository.js";
import { requireRoomRole } from "./routes/route-guards.js";

const STATE_KIND = ROOM_EXPERIENCE_STATE_KINDS.RECAP_LIBRARY;
const SCOPE_KEY = "player_library";

function identity(actorId) {
  return normalizeRoomExperienceIdentity({
    stateKind: STATE_KIND,
    scopeKey: SCOPE_KEY,
    subjectKey: actorId,
    visibility: "role",
  });
}

export function mapRecapLibraryRow(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    roomName: row.room_name,
    worldId: row.world_id,
    worldName: row.world_name,
    roleSlotId: row.role_slot_id,
    roleName: row.role_name || "未分配角色",
    label: row.label,
    description: row.description || "",
    createdAt: row.created_at,
    retentionDays: Number(row.retention_days || 0),
    summary: summarizeRecap({ stats: row.stats || {} }),
  };
}

export async function listRecapLibrary({ actorId, worldId = null, roleSlotId = null, limit = 100 }) {
  const rows = await listAccountRecapRows({ actorId, worldId, roleSlotId, limit });
  return { recaps: rows.map(mapRecapLibraryRow) };
}

export async function getRecapLibraryEntry({ actorId, recapId }) {
  const row = await findAccountRecapContext({ actorId, recapId });
  if (!row) throwErr("RECAP_NOT_FOUND");
  const isHost = ["host", "cohost"].includes(row.member_type);
  if (!isHost && !row.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
  const snapshot = isHost
    ? { ...row.snapshot, perspective: "host" }
    : filterRecapForPlayer(row.snapshot, row.role_slot_id);
  return {
    ...mapRecapLibraryRow({ ...row, stats: row.snapshot?.stats, description: row.snapshot?.description }),
    perspective: isHost ? "host" : "postgame",
    snapshot,
  };
}

async function savePreferences({ actorId, roomId, mutate }) {
  await requireRoomRole(actorId, roomId);
  return transaction(async (client) => {
    const current = await findRoomExperienceState(roomId, {
      stateKind: STATE_KIND,
      scopeKey: SCOPE_KEY,
      subjectKey: actorId,
      client,
      forUpdate: true,
    });
    const payload = normalizeRoomExperiencePayload(STATE_KIND, mutate(current?.payload || {
      hiddenRecapIds: [],
      retentionDays: 0,
    }));
    const saved = current
      ? await updateRoomExperienceState(client, {
          roomId,
          ...identity(actorId),
          expectedRevision: current.revision,
          payload,
          actorId,
        })
      : await insertRoomExperienceState(client, {
          roomId,
          ...identity(actorId),
          payload,
          actorId,
        });
    if (!saved) throwErr("RECAP_LIBRARY_VERSION_CONFLICT");
    return { preferences: saved.payload, revision: saved.revision };
  });
}

export async function hideRecapLibraryEntry({ actorId, recapId }) {
  const context = await findAccountRecapContext({ actorId, recapId, includeHidden: true });
  if (!context) throwErr("RECAP_NOT_FOUND");
  await savePreferences({
    actorId,
    roomId: context.room_id,
    mutate: (payload) => ({
      ...payload,
      hiddenRecapIds: [...new Set([...(payload.hiddenRecapIds || []), recapId])],
    }),
  });
  return { ok: true };
}

export function updateRecapLibraryPreferences({ actorId, roomId, retentionDays }) {
  return savePreferences({
    actorId,
    roomId,
    mutate: (payload) => ({ ...payload, retentionDays }),
  });
}
