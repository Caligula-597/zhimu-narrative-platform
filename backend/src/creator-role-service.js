import { throwErr } from "./api-errors.js";
import {
  assertCreatorStructureEditor,
  runCreatorStructureMutation
} from "./creator-structure-service.js";
import {
  deleteCreatorRole,
  insertCreatorRole,
  lockCreatorRole,
  updateCreatorRole
} from "./repositories/creator-role-repository.js";
import { assertRuntimeObjectDeletionAllowed } from "./runtime-release-guard.js";

export function addCreatorRole({ request, reply, actorId, worldId, body }) {
  const name = String(body?.name ?? "").trim();
  if (!name) throwErr("NAME_EMPTY");
  return runCreatorStructureMutation({
    request,
    reply,
    worldId,
    statusCode: 201,
    write: async (client) => {
      await assertCreatorStructureEditor(client, { worldId, actorId });
      return insertCreatorRole(client, {
        worldId,
        name,
        publicProfile: body.publicProfile ?? "",
        privateProfile: body.privateProfile ?? "",
        sequence: body.sequence
      });
    }
  });
}

export function reviseCreatorRole({ request, reply, actorId, worldId, roleSlotId, body }) {
  const name = String(body?.name ?? "").trim();
  if (!name) throwErr("NAME_EMPTY");
  return runCreatorStructureMutation({
    request,
    reply,
    worldId,
    write: async (client) => {
      await assertCreatorStructureEditor(client, { worldId, actorId });
      const current = await lockCreatorRole(client, { worldId, roleSlotId });
      if (!current) throwErr("ROLE_SLOT_NOT_FOUND");
      return updateCreatorRole(client, {
        roleSlotId,
        name,
        publicProfile: body.publicProfile ?? current.public_profile,
        privateProfile: body.privateProfile ?? current.private_profile,
        sequence: body.sequence
      });
    }
  });
}

export function removeCreatorRole({ request, reply, actorId, worldId, roleSlotId }) {
  return runCreatorStructureMutation({
    request,
    reply,
    worldId,
    write: async (client) => {
      await assertCreatorStructureEditor(client, { worldId, actorId });
      const current = await lockCreatorRole(client, { worldId, roleSlotId });
      if (!current) throwErr("ROLE_SLOT_NOT_FOUND");
      if (current.world_role_count <= 1) throwErr("LAST_ROLE_SLOT_REQUIRED");
      if (current.has_active_members) throwErr("ROLE_SLOT_IN_USE");
      await assertRuntimeObjectDeletionAllowed(client, {
        worldId,
        field: "roles",
        objectId: roleSlotId
      });
      if (!await deleteCreatorRole(client, roleSlotId)) throwErr("ROLE_SLOT_NOT_FOUND");
      return { ok: true };
    }
  });
}
