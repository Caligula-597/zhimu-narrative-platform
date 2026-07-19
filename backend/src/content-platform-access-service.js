import { throwErr } from "./api-errors.js";
import {
  lockActiveHostMembership,
  lockActivePlayerMembership,
  lockRoleInRoomWorld,
  lockWorldEditor
} from "./repositories/content-platform-access-repository.js";

export async function assertContentPlatformEditor(client, { worldId, actorId }) {
  const role = await lockWorldEditor(client, { worldId, actorId });
  if (!role) throwErr("WORLD_ACCESS_DENIED");
  if (!["owner", "editor"].includes(role)) throwErr("WORLD_EDITOR_REQUIRED");
  return role;
}

export async function assertContentPlatformHost(client, { roomId, actorId }) {
  const membership = await lockActiveHostMembership(client, { roomId, actorId });
  if (!membership) throwErr("HOST_ROLE_REQUIRED");
  return membership;
}

export async function assertContentPlatformPlayer(client, { roomId, actorId }) {
  const membership = await lockActivePlayerMembership(client, { roomId, actorId });
  if (!membership) throwErr("PLAYER_ROLE_REQUIRED");
  return membership;
}

export async function assertContentPlatformRoomRole(client, { roomId, roleSlotId }) {
  const role = await lockRoleInRoomWorld(client, { roomId, roleSlotId });
  if (!role) throwErr("ROLE_SLOT_WORLD_MISMATCH");
  return role;
}
