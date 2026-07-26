import { assertCapability } from "./capabilities.js";
import { throwErr } from "./api-errors.js";
import { prepareRoleSlotForJoin } from "./role-slot-runtime-helpers.js";
import { transactionWithEvents } from "./transaction-events.js";
import {
  bindJoinMembership,
  configureJoinTransaction,
  ensureJoinMembershipRow,
  findInviteAccess,
  findJoinTarget,
  lockActiveSeatOccupant,
  lockJoinMembership
} from "./repositories/player-access-repository.js";
import { projectRoomContentBinding } from "./room-content-binding.js";

export async function loadRoomInviteAccess(actorId, inviteCode) {
  const row = await findInviteAccess(inviteCode, actorId);
  if (!row) throwErr("ROOM_NOT_FOUND");
  return {
    room: {
      id: row.id,
      name: row.name,
      status: row.status,
      contentBinding: projectRoomContentBinding(row, {
        runtimeSource: row.release_id ? "release_snapshot" : "live_draft"
      })
    },
    world: { id: row.world_id, name: row.world_name },
    current_role_slot_id: row.current_role_slot_id ?? null,
    roles: row.roles ?? []
  };
}

export async function joinRoomByInvite(actorId, { inviteCode, roleSlotId }) {
  await assertCapability(actorId, "room.join");
  try {
    return await transactionWithEvents(async (client, queueEvent) => {
      await configureJoinTransaction(client);
      const target = await findJoinTarget(client, inviteCode, roleSlotId);
      if (!target) throwErr("ROOM_NOT_FOUND");
      if (!target.role_slot_id) throwErr("ROLE_SLOT_WORLD_MISMATCH");
      const targetRoleId = target.role_slot_id;

      // Materialize and lock the actor's membership before checking its role.
      // This closes the no-row race where two concurrent joins could bind the
      // same player to different seats through ON CONFLICT updates.
      await ensureJoinMembershipRow(client, target.room_id, actorId);
      const membership = await lockJoinMembership(client, target.room_id, actorId);
      const boundRoleId = membership?.status === "active"
        ? membership.role_slot_id ?? null
        : null;
      if (boundRoleId) {
        if (boundRoleId === targetRoleId) return target.room_id;
        throwErr("ROLE_ALREADY_BOUND");
      }

      const occupied = await lockActiveSeatOccupant(client, target.room_id, targetRoleId, actorId);
      if (occupied) throwErr("ROLE_SLOT_OCCUPIED");

      await prepareRoleSlotForJoin(client, target.room_id, targetRoleId, actorId);
      await bindJoinMembership(client, target.room_id, actorId, targetRoleId);
      queueEvent(target.room_id, "room.player_joined", {
        roleSlotId: targetRoleId,
        roleName: target.role_name || "玩家角色"
      });
      return target.room_id;
    });
  } catch (error) {
    if (error.code === "23505") {
      throwErr("ROLE_SLOT_OCCUPIED", "该角色席位已被其他玩家占用。");
    }
    if (error.code === "55P03" || error.code === "57014") {
      throwErr("UNAVAILABLE", "加入房间请求繁忙，请稍后重试。");
    }
    throw error;
  }
}
