import { throwErr } from "./api-errors.js";
import { grantItemToInventory } from "./inventory-helpers.js";
import { evaluateRoomRulesWithClient } from "./rule-engine.js";
import { transactionWithEvents } from "./transaction-events.js";
import {
  appendHostContentAudit,
  appendHostContentTimeline,
  configureHostContentActionTransaction,
  findClueInRoomWorld,
  findRoleIdsInRoomWorld,
  findSceneInRoomWorld,
  findSectionInRoomRole,
  grantClueToRoles,
  hasActiveHostMembership,
  unlockScene,
  unlockSection
} from "./repositories/host-content-action-repository.js";

async function assertHostAccess(client, roomId, actorId) {
  if (!await hasActiveHostMembership(client, { roomId, actorId })) {
    throwErr("HOST_ROLE_REQUIRED");
  }
}

async function assertRolesInRoomWorld(client, roomId, roleSlotIds) {
  const validIds = await findRoleIdsInRoomWorld(client, { roomId, roleSlotIds });
  if (validIds.length !== roleSlotIds.length) throwErr("ROLE_SLOT_WORLD_MISMATCH");
}

export async function grantClueFromHost({ roomId, actorId, targets, clueId, message }) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureHostContentActionTransaction(client);
    await assertHostAccess(client, roomId, actorId);
    const clue = await findClueInRoomWorld(client, { roomId, clueId });
    if (!clue) throwErr("CLUE_WORLD_MISMATCH");
    await assertRolesInRoomWorld(client, roomId, targets);

    const grantedRoleSlotIds = await grantClueToRoles(client, {
      roomId,
      roleSlotIds: targets,
      clueId
    });
    for (const roleSlotId of grantedRoleSlotIds) {
      queueEvent(roomId, "room.clue_granted", {
        clueId,
        roleSlotId,
        clueName: clue.name,
        source: "host_manual"
      });
    }

    if (grantedRoleSlotIds.length) {
      await appendHostContentTimeline(client, {
        roomId,
        actorId,
        eventType: "host_grant_clue",
        message: message || `主持人手动发放线索「${clue.name}」给 ${grantedRoleSlotIds.length} 名玩家`,
        metadata: { roleSlotIds: grantedRoleSlotIds, clueId }
      });
    }
    await appendHostContentAudit(client, {
      roomId,
      actorId,
      action: "host_grant_clue",
      targetType: "clue",
      targetId: clueId,
      metadata: { requestedRoleSlotIds: targets, grantedRoleSlotIds }
    });
    return { ok: true, granted: grantedRoleSlotIds.length };
  });
}

export async function grantItemFromHost({
  roomId,
  actorId,
  roleSlotId,
  itemId,
  quantity,
  message
}) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureHostContentActionTransaction(client);
    await assertHostAccess(client, roomId, actorId);
    await assertRolesInRoomWorld(client, roomId, [roleSlotId]);
    const item = await grantItemToInventory(client, {
      roomId,
      roleSlotId,
      itemId,
      quantity,
      source: "host_manual"
    });
    const grantedQuantity = item.metadata?.unique ? 1 : quantity;
    await appendHostContentTimeline(client, {
      roomId,
      actorId,
      eventType: "host_grant_item",
      message: message || `主持人发放物品「${item.name}」`,
      metadata: { roleSlotId, itemId, quantity: grantedQuantity }
    });
    await appendHostContentAudit(client, {
      roomId,
      actorId,
      action: "host_grant_item",
      targetType: "item",
      targetId: itemId,
      metadata: { roleSlotId, quantity: grantedQuantity }
    });
    queueEvent(roomId, "room.item_granted", {
      itemId,
      roleSlotId,
      itemName: item.name,
      source: "host_manual"
    });
    const executedRules = await evaluateRoomRulesWithClient(client, queueEvent, roomId);
    return { ok: true, item: { id: item.id, name: item.name }, executedRules };
  });
}

export async function unlockSectionFromHost({
  roomId,
  actorId,
  roleSlotId,
  scriptSectionId,
  message
}) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureHostContentActionTransaction(client);
    await assertHostAccess(client, roomId, actorId);
    const section = await findSectionInRoomRole(client, { roomId, roleSlotId, scriptSectionId });
    if (!section) throwErr("SECTION_NOT_FOUND");
    const newlyUnlocked = await unlockSection(client, { roomId, scriptSectionId });

    if (newlyUnlocked) {
      await appendHostContentTimeline(client, {
        roomId,
        actorId,
        eventType: "host_unlock_section",
        message: message || `主持人手动解锁分幕「${section.title}」`,
        metadata: { roleSlotId, sectionId: scriptSectionId }
      });
      queueEvent(roomId, "room.section_unlocked", {
        scriptSectionId,
        roleSlotId,
        source: "host_manual"
      });
    }
    await appendHostContentAudit(client, {
      roomId,
      actorId,
      action: "host_unlock_section",
      targetType: "script_section",
      targetId: scriptSectionId,
      metadata: { roleSlotId, newlyUnlocked }
    });
    return { ok: true };
  });
}

export async function unlockSceneFromHost({ roomId, actorId, sceneId }) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureHostContentActionTransaction(client);
    await assertHostAccess(client, roomId, actorId);
    const scene = await findSceneInRoomWorld(client, { roomId, sceneId });
    if (!scene) throwErr("SCENE_WORLD_MISMATCH");
    const newlyUnlocked = await unlockScene(client, { roomId, sceneId });

    if (newlyUnlocked) {
      await appendHostContentTimeline(client, {
        roomId,
        actorId,
        eventType: "scene_unlocked",
        message: `主持人开放场景「${scene.name}」`,
        metadata: { sceneId }
      });
      queueEvent(roomId, "room.scene_unlocked", {
        sceneId,
        sceneName: scene.name,
        source: "host_manual"
      });
    }
    await appendHostContentAudit(client, {
      roomId,
      actorId,
      action: "host_unlock_scene",
      targetType: "scene",
      targetId: sceneId,
      metadata: { newlyUnlocked }
    });
    return { ok: true };
  });
}
