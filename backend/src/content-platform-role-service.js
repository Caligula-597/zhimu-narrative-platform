import { sendErr, throwErr } from "./api-errors.js";
import {
  assertContentPlatformEditor,
  assertContentPlatformHost,
  assertContentPlatformRoomRole
} from "./content-platform-access-service.js";
import {
  configureContentPlatformTransaction
} from "./repositories/content-platform-access-repository.js";
import {
  appendRoleStateAudit,
  deleteRoleRelationship,
  listWorldRoleRelationships,
  lockWorldRoleIds,
  upsertRoleRelationship,
  upsertRoomRoleState
} from "./repositories/content-platform-role-repository.js";
import { transactionWithEvents } from "./transaction-events.js";
import { runRevisionMutation } from "./world-revision.js";

export function getWorldRoleRelationships(worldId) {
  return listWorldRoleRelationships(worldId);
}

export function saveWorldRoleRelationship({ request, reply, actorId, worldId, body }) {
  if (body.fromRoleSlotId === body.toRoleSlotId) {
    throwErr("ROLE_RELATIONSHIP_SELF_INVALID");
  }
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertContentPlatformEditor(client, { worldId, actorId });
    const roleIds = await lockWorldRoleIds(client, {
      worldId,
      roleSlotIds: [body.fromRoleSlotId, body.toRoleSlotId]
    });
    if (roleIds.length !== 2) throwErr("ROLE_SLOT_WORLD_MISMATCH");
    const saved = await upsertRoleRelationship(client, { worldId, body });
    return {
      relationship: saved.relationship,
      changed: saved.changed
    };
  }, {
    sendErr,
    statusCode: 201,
    configureClient: configureContentPlatformTransaction,
    shouldBumpRevision: (result) => {
      const changed = result.changed;
      delete result.changed;
      return changed;
    }
  });
}

export function removeWorldRoleRelationship({
  request,
  reply,
  actorId,
  worldId,
  relationshipId
}) {
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertContentPlatformEditor(client, { worldId, actorId });
    const deleted = await deleteRoleRelationship(client, { worldId, relationshipId });
    if (!deleted) throwErr("NOT_FOUND");
    return { ok: true };
  }, { sendErr, configureClient: configureContentPlatformTransaction });
}

export async function updateRoomRoleState({ actorId, roomId, roleSlotId, body }) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureContentPlatformTransaction(client);
    await assertContentPlatformHost(client, { roomId, actorId });
    await assertContentPlatformRoomRole(client, { roomId, roleSlotId });
    const state = await upsertRoomRoleState(client, {
      roomId,
      roleSlotId,
      actorId,
      body
    });
    await appendRoleStateAudit(client, {
      roomId,
      actorId,
      roleSlotId,
      factionKey: body.factionKey
    });
    queueEvent(roomId, "room.role_state_updated", { roleSlotId });
    return state;
  });
}
