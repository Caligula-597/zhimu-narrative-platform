import { httpError, throwErr } from "./api-errors.js";
import {
  configureHostPlayerManagementTransaction,
  hasActiveHostPlayerManagementMembership,
  insertHostPlayerManagementAudit,
  insertPlayerKickedTimelineLog,
  lockActivePlayerOccupant,
  removeLockedPlayerOccupant,
  roleBelongsToHostPlayerRoomWorld,
  upsertHostPlayerNotes
} from "./repositories/host-player-management-repository.js";
import { recordRoleSlotLastOccupant } from "./role-slot-runtime-helpers.js";
import { requireHostMembership } from "./routes/host-route-guards.js";
import { transactionWithEvents } from "./transaction-events.js";

export function normalizeHostPlayerManagementError(error) {
  if (["40P01", "55P03"].includes(error?.code)) {
    return httpError(409, "Host player management is busy; retry shortly", "HOST_PLAYER_MANAGEMENT_BUSY");
  }
  if (error?.code === "57014") {
    return httpError(503, "Host player management exceeded its safe execution window", "HOST_PLAYER_MANAGEMENT_TIMEOUT");
  }
  return error;
}

async function assertTransactionHostMembership(client, { actorId, roomId }) {
  if (!await hasActiveHostPlayerManagementMembership(client, { actorId, roomId })) {
    throwErr("HOST_ROLE_REQUIRED");
  }
}

export async function saveHostPlayerNotes({ actorId, roomId, roleSlotId, notes }) {
  await requireHostMembership(actorId, roomId);
  const normalizedNotes = String(notes ?? "");
  try {
    return await transactionWithEvents(async (client, queueEvent) => {
      await configureHostPlayerManagementTransaction(client);
      await assertTransactionHostMembership(client, { actorId, roomId });
      const updated = await upsertHostPlayerNotes(client, {
        roomId,
        roleSlotId,
        notes: normalizedNotes
      });
      if (!updated) throwErr("ROLE_SLOT_WORLD_MISMATCH");
      await insertHostPlayerManagementAudit(client, {
        roomId,
        actorId,
        action: "host_player_notes_updated",
        roleSlotId,
        metadata: { noteLength: normalizedNotes.length }
      });
      queueEvent(roomId, "room.host_player_notes_updated", {
        roleSlotId: String(roleSlotId),
        updatedAt: new Date(updated.updated_at).toISOString()
      });
      return { ok: true, roleSlotId, updatedAt: updated.updated_at };
    });
  } catch (error) {
    throw normalizeHostPlayerManagementError(error);
  }
}

export async function kickHostPlayer({ actorId, roomId, roleSlotId }) {
  await requireHostMembership(actorId, roomId);
  try {
    return await transactionWithEvents(async (client, queueEvent) => {
      await configureHostPlayerManagementTransaction(client);
      await assertTransactionHostMembership(client, { actorId, roomId });
      if (!await roleBelongsToHostPlayerRoomWorld(client, { roomId, roleSlotId })) {
        throwErr("ROLE_SLOT_WORLD_MISMATCH");
      }
      const member = await lockActivePlayerOccupant(client, { roomId, roleSlotId });
      if (!member) throwErr("ROLE_SLOT_NOT_OCCUPIED");

      const userId = String(member.user_id);
      const roleName = String(member.role_name || "");
      const displayName = String(member.display_name || "");
      await recordRoleSlotLastOccupant(client, roomId, roleSlotId, userId);
      if (!await removeLockedPlayerOccupant(client, { roomId, roleSlotId, userId })) {
        throwErr("ROLE_SLOT_NOT_OCCUPIED");
      }
      const log = await insertPlayerKickedTimelineLog(client, {
        roomId,
        actorId,
        roleSlotId,
        userId,
        roleName,
        displayName
      });
      await insertHostPlayerManagementAudit(client, {
        roomId,
        actorId,
        action: "host_kick_player",
        roleSlotId,
        metadata: { userId, roleName, displayName, logId: String(log.id) }
      });
      queueEvent(roomId, "room.player_kicked", { roleSlotId, userId, roleName });
      return { ok: true, userId, roleSlotId, roleName, logId: String(log.id) };
    });
  } catch (error) {
    throw normalizeHostPlayerManagementError(error);
  }
}
