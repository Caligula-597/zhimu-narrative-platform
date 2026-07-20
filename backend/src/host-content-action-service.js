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
  relockSection,
  resendClueToRole,
  revokeClueFromRole,
  skipSectionProgress,
  unlockScene,
  unlockSection
} from "./repositories/host-content-action-repository.js";

async function assertHostAccess(client, roomId, actorId) {
  if (!await hasActiveHostMembership(client, { roomId, actorId })) {
    throwErr("HOST_ROLE_REQUIRED");
  }
}

export async function revokeClueFromHost({ roomId, actorId, roleSlotId, clueId, message }) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureHostContentActionTransaction(client);
    await assertHostAccess(client, roomId, actorId);
    const clue = await findClueInRoomWorld(client, { roomId, clueId });
    if (!clue) throwErr("CLUE_WORLD_MISMATCH");
    await assertRolesInRoomWorld(client, roomId, [roleSlotId]);
    const revoked = await revokeClueFromRole(client, { roomId, roleSlotId, clueId });
    if (revoked) {
      await appendHostContentTimeline(client, {
        roomId,
        actorId,
        eventType: "host_revoke_clue",
        message: message || `主持人撤回线索「${clue.name}」`,
        metadata: { roleSlotId, clueId }
      });
      queueEvent(roomId, "room.clue_revoked", {
        clueId,
        roleSlotId,
        clueName: clue.name,
        source: "host_manual"
      });
    }
    await appendHostContentAudit(client, {
      roomId,
      actorId,
      action: "host_revoke_clue",
      targetType: "clue",
      targetId: clueId,
      metadata: { roleSlotId, revoked }
    });
    return { ok: true, revoked };
  });
}

export async function resendClueFromHost({ roomId, actorId, roleSlotId, clueId, message }) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureHostContentActionTransaction(client);
    await assertHostAccess(client, roomId, actorId);
    const clue = await findClueInRoomWorld(client, { roomId, clueId });
    if (!clue) throwErr("CLUE_WORLD_MISMATCH");
    await assertRolesInRoomWorld(client, roomId, [roleSlotId]);
    const result = await resendClueToRole(client, { roomId, roleSlotId, clueId });
    await appendHostContentTimeline(client, {
      roomId,
      actorId,
      eventType: "host_resend_clue",
      message: message || `主持人补发线索「${clue.name}」`,
      metadata: { roleSlotId, clueId, ...result }
    });
    await appendHostContentAudit(client, {
      roomId,
      actorId,
      action: "host_resend_clue",
      targetType: "clue",
      targetId: clueId,
      metadata: { roleSlotId, ...result }
    });
    queueEvent(roomId, "room.clue_resent", {
      clueId,
      roleSlotId,
      clueName: clue.name,
      source: "host_manual"
    });
    return { ok: true, ...result };
  });
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

export async function relockSectionFromHost({
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
    if (Number(section.sequence) === 1) throwErr("SECTION_ALWAYS_AVAILABLE");
    const relocked = await relockSection(client, { roomId, scriptSectionId });
    if (relocked) {
      await appendHostContentTimeline(client, {
        roomId,
        actorId,
        eventType: "host_relock_section",
        message: message || `主持人撤回分幕「${section.title}」`,
        metadata: { roleSlotId, sectionId: scriptSectionId }
      });
      queueEvent(roomId, "room.section_relocked", {
        sectionId: scriptSectionId,
        roleSlotId,
        source: "host_manual"
      });
    }
    await appendHostContentAudit(client, {
      roomId,
      actorId,
      action: "host_relock_section",
      targetType: "script_section",
      targetId: scriptSectionId,
      metadata: { roleSlotId, relocked }
    });
    return { ok: true, relocked };
  });
}

export async function skipSectionFromHost({
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
    const progress = await skipSectionProgress(client, { roomId, roleSlotId, scriptSectionId });
    if (progress.newlyCompleted) {
      await appendHostContentTimeline(client, {
        roomId,
        actorId,
        eventType: "host_skip_section",
        message: message || `主持人跳过分幕「${section.title}」并标记完成`,
        metadata: { roleSlotId, sectionId: scriptSectionId, skipped: true }
      });
      queueEvent(roomId, "room.section_skipped", {
        sectionId: scriptSectionId,
        roleSlotId,
        source: "host_manual"
      });
    }
    await appendHostContentAudit(client, {
      roomId,
      actorId,
      action: "host_skip_section",
      targetType: "script_section",
      targetId: scriptSectionId,
      metadata: { roleSlotId, newlyCompleted: progress.newlyCompleted }
    });
    const executedRules = progress.newlyCompleted
      ? await evaluateRoomRulesWithClient(client, queueEvent, roomId)
      : [];
    return { ok: true, skipped: progress.newlyCompleted, executedRules };
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
