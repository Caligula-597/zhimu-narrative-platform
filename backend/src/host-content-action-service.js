import { throwErr } from "./api-errors.js";
import { listMaterialBooklets } from "./creator-bible.js";
import { query } from "./db.js";
import { grantItemToInventory } from "./inventory-helpers.js";
import { evaluateRoomRulesWithClient } from "./rule-engine.js";
import { transactionWithEvents } from "./transaction-events.js";
import { loadRuntimeContentProvider } from "./runtime-content-provider.js";
import { resolveSectionSegmentKey } from "../../shared/segment-contract.js";
import { sceneMatchesActUnlock } from "../../shared/host-act-scene-match.js";
import {
  appendHostContentAudit,
  appendHostContentTimeline,
  configureHostContentActionTransaction,
  findBookletInRoomWorld,
  findClueInRoomWorld,
  findRoleIdsInRoomWorld,
  findSceneInRoomWorld,
  findSectionInRoomRole,
  grantBookletToRoles,
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

function loadActionContent(client, roomId) {
  return loadRuntimeContentProvider(roomId, {
    runQuery: client.query.bind(client),
    includeLiveSnapshot: false
  });
}

async function findRuntimeClue(client, provider, { roomId, clueId }) {
  return provider?.isFrozen
    ? provider.find("clues", clueId)
    : findClueInRoomWorld(client, { roomId, clueId });
}

async function findRuntimeSection(client, provider, {
  roomId,
  roleSlotId,
  scriptSectionId
}) {
  if (!provider?.isFrozen) {
    return findSectionInRoomRole(client, { roomId, roleSlotId, scriptSectionId });
  }
  const section = provider.find("sections", scriptSectionId);
  return String(section?.role_slot_id) === String(roleSlotId) ? section : null;
}

async function findRuntimeScene(client, provider, { roomId, sceneId }) {
  return provider?.isFrozen
    ? provider.find("scenes", sceneId)
    : findSceneInRoomWorld(client, { roomId, sceneId });
}

export async function revokeClueFromHost({ roomId, actorId, roleSlotId, clueId, message }) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureHostContentActionTransaction(client);
    await assertHostAccess(client, roomId, actorId);
    const provider = await loadActionContent(client, roomId);
    const clue = await findRuntimeClue(client, provider, { roomId, clueId });
    if (!clue) throwErr("CLUE_WORLD_MISMATCH");
    await assertRolesInRoomWorld(client, roomId, [roleSlotId], provider);
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
    const provider = await loadActionContent(client, roomId);
    const clue = await findRuntimeClue(client, provider, { roomId, clueId });
    if (!clue) throwErr("CLUE_WORLD_MISMATCH");
    await assertRolesInRoomWorld(client, roomId, [roleSlotId], provider);
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

async function assertRolesInRoomWorld(client, roomId, roleSlotIds, provider = null) {
  if (provider?.isFrozen) {
    if (roleSlotIds.every((roleSlotId) => provider.find("roles", roleSlotId))) return;
    throwErr("ROLE_SLOT_WORLD_MISMATCH");
  }
  const validIds = await findRoleIdsInRoomWorld(client, { roomId, roleSlotIds });
  if (validIds.length !== roleSlotIds.length) throwErr("ROLE_SLOT_WORLD_MISMATCH");
}

export async function grantClueFromHost({ roomId, actorId, targets, clueId, message }) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureHostContentActionTransaction(client);
    await assertHostAccess(client, roomId, actorId);
    const provider = await loadActionContent(client, roomId);
    const clue = await findRuntimeClue(client, provider, { roomId, clueId });
    if (!clue) throwErr("CLUE_WORLD_MISMATCH");
    await assertRolesInRoomWorld(client, roomId, targets, provider);

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

export async function listMaterialBookletsForHost({ roomId, actorId }) {
  const membership = await query(
    `SELECT 1
     FROM room_members
     WHERE room_id = $1 AND user_id = $2 AND status = 'active'
       AND member_type IN ('host', 'cohost')`,
    [roomId, actorId]
  );
  if (!membership.rowCount) throwErr("HOST_ROLE_REQUIRED");
  const room = await query(`SELECT world_id FROM rooms WHERE id = $1`, [roomId]);
  if (!room.rowCount) throwErr("ROOM_NOT_FOUND");
  return listMaterialBooklets(room.rows[0].world_id);
}

export async function grantMaterialBookletFromHost({
  roomId,
  actorId,
  targets,
  bookletId,
  message
}) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureHostContentActionTransaction(client);
    await assertHostAccess(client, roomId, actorId);
    const provider = await loadActionContent(client, roomId);
    const booklet = await findBookletInRoomWorld(client, { roomId, bookletId });
    if (!booklet) throwErr("BOOKLET_WORLD_MISMATCH");
    await assertRolesInRoomWorld(client, roomId, targets, provider);

    const grantedRoleSlotIds = await grantBookletToRoles(client, {
      roomId,
      roleSlotIds: targets,
      bookletId,
      actorId,
      message: message || ""
    });

    const linkedClueIds = Array.isArray(booklet.linked_clue_ids) ? booklet.linked_clue_ids : [];
    const linkedClueGrants = [];
    for (const clueId of linkedClueIds) {
      const clue = await findRuntimeClue(client, provider, { roomId, clueId });
      if (!clue) continue;
      const clueGrantedRoleSlotIds = await grantClueToRoles(client, {
        roomId,
        roleSlotIds: targets,
        clueId
      });
      linkedClueGrants.push({ clueId, grantedRoleSlotIds: clueGrantedRoleSlotIds });
      for (const roleSlotId of clueGrantedRoleSlotIds) {
        queueEvent(roomId, "room.clue_granted", {
          clueId,
          roleSlotId,
          clueName: clue.name,
          source: "host_booklet_grant"
        });
      }
    }

    for (const roleSlotId of grantedRoleSlotIds) {
      queueEvent(roomId, "room.booklet_granted", {
        bookletId,
        roleSlotId,
        bookletTitle: booklet.title,
        source: "host_manual"
      });
    }

    if (grantedRoleSlotIds.length) {
      await appendHostContentTimeline(client, {
        roomId,
        actorId,
        eventType: "host_grant_booklet",
        message: message || `主持人发放物料册「${booklet.title || "未命名"}」给 ${grantedRoleSlotIds.length} 名玩家`,
        metadata: {
          roleSlotIds: grantedRoleSlotIds,
          bookletId,
          linkedClueIds
        }
      });
    }
    await appendHostContentAudit(client, {
      roomId,
      actorId,
      action: "host_grant_booklet",
      targetType: "material_booklet",
      targetId: bookletId,
      metadata: {
        requestedRoleSlotIds: targets,
        grantedRoleSlotIds,
        linkedClueGrants
      }
    });
    return {
      ok: true,
      granted: grantedRoleSlotIds.length,
      linkedClueGrants
    };
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
    const provider = await loadActionContent(client, roomId);
    await assertRolesInRoomWorld(client, roomId, [roleSlotId], provider);
    const authoredItem = provider?.isFrozen ? provider.find("items", itemId) : null;
    if (provider?.isFrozen && !authoredItem) throwErr("ITEM_NOT_FOUND");
    const item = await grantItemToInventory(client, {
      roomId,
      roleSlotId,
      itemId,
      quantity,
      source: "host_manual"
    });
    if (authoredItem) {
      item.name = authoredItem.name;
      item.public_text = authoredItem.public_text;
      item.host_text = authoredItem.host_text;
      item.metadata = authoredItem.metadata;
    }
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
    const provider = await loadActionContent(client, roomId);
    const section = await findRuntimeSection(client, provider, {
      roomId, roleSlotId, scriptSectionId
    });
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
    const provider = await loadActionContent(client, roomId);
    const section = await findRuntimeSection(client, provider, {
      roomId, roleSlotId, scriptSectionId
    });
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
    const provider = await loadActionContent(client, roomId);
    const section = await findRuntimeSection(client, provider, {
      roomId, roleSlotId, scriptSectionId
    });
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
    const provider = await loadActionContent(client, roomId);
    const scene = await findRuntimeScene(client, provider, { roomId, sceneId });
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

function sectionMatchesActUnlock(section, { actKey, sequence }) {
  if (actKey && String(resolveSectionSegmentKey(section, section.sequence || 1)) === String(actKey)) {
    return true;
  }
  if (sequence != null && Number(section.sequence) === Number(sequence)) return true;
  return false;
}

export async function unlockActFromHost({ roomId, actorId, actKey, sequence, message }) {
  if (!actKey && sequence == null) throwErr("SECTION_NOT_FOUND");
  return transactionWithEvents(async (client, queueEvent) => {
    await configureHostContentActionTransaction(client);
    await assertHostAccess(client, roomId, actorId);
    const provider = await loadActionContent(client, roomId);
    const sections = (provider?.collection("sections") || [])
      .filter((section) => sectionMatchesActUnlock(section, { actKey, sequence }))
      .filter((section) => Number(section.sequence) !== 1);
    if (!sections.length) throwErr("SECTION_NOT_FOUND");

    const unlockedSectionIds = [];
    for (const section of sections) {
      const newlyUnlocked = await unlockSection(client, {
        roomId,
        scriptSectionId: section.id
      });
      if (newlyUnlocked) {
        unlockedSectionIds.push(String(section.id));
        queueEvent(roomId, "room.section_unlocked", {
          scriptSectionId: section.id,
          roleSlotId: section.role_slot_id,
          source: "host_unlock_act"
        });
      }
    }

    if (unlockedSectionIds.length) {
      await appendHostContentTimeline(client, {
        roomId,
        actorId,
        eventType: "host_unlock_act",
        message: message || `主持人开放本幕分幕（全员 ${unlockedSectionIds.length} 段）`,
        metadata: { actKey: actKey || null, sequence: sequence ?? null, sectionIds: unlockedSectionIds }
      });
    }
    await appendHostContentAudit(client, {
      roomId,
      actorId,
      action: "host_unlock_act",
      targetType: "script_section",
      targetId: unlockedSectionIds[0] || null,
      metadata: {
        actKey: actKey || null,
        sequence: sequence ?? null,
        unlockedCount: unlockedSectionIds.length,
        sectionIds: unlockedSectionIds
      }
    });
    return { ok: true, unlockedCount: unlockedSectionIds.length, sectionIds: unlockedSectionIds };
  });
}

export { sceneMatchesActUnlock } from "../../shared/host-act-scene-match.js";

export async function unlockActScenesFromHost({
  roomId,
  actorId,
  actKey,
  sequence,
  chapterId,
  sceneIds,
  message
}) {
  const hasSceneIds = Array.isArray(sceneIds) && sceneIds.length;
  if (!hasSceneIds && !actKey && sequence == null && !chapterId) {
    throwErr("SCENE_NOT_FOUND");
  }
  return transactionWithEvents(async (client, queueEvent) => {
    await configureHostContentActionTransaction(client);
    await assertHostAccess(client, roomId, actorId);
    const provider = await loadActionContent(client, roomId);
    const chapters = provider?.collection("chapters") || [];
    const allScenes = provider?.collection("scenes") || [];
    const scenes = hasSceneIds
      ? sceneIds
        .map((sceneId) => provider?.find("scenes", sceneId)
          || allScenes.find((candidate) => String(candidate.id) === String(sceneId)))
        .filter(Boolean)
      : allScenes.filter((scene) => sceneMatchesActUnlock(scene, chapters, { actKey, sequence, chapterId }));
    if (!scenes.length) throwErr("SCENE_NOT_FOUND");

    const unlockedSceneIds = [];
    for (const scene of scenes) {
      const newlyUnlocked = await unlockScene(client, { roomId, sceneId: scene.id });
      if (newlyUnlocked) {
        unlockedSceneIds.push(String(scene.id));
        queueEvent(roomId, "room.scene_unlocked", {
          sceneId: scene.id,
          sceneName: scene.name,
          source: "host_unlock_act_scenes"
        });
      }
    }

    if (unlockedSceneIds.length) {
      await appendHostContentTimeline(client, {
        roomId,
        actorId,
        eventType: "host_unlock_act_scenes",
        message: message || `主持人开放本幕场景（${unlockedSceneIds.length} 处）`,
        metadata: {
          actKey: actKey || null,
          sequence: sequence ?? null,
          chapterId: chapterId || null,
          sceneIds: unlockedSceneIds
        }
      });
    }
    await appendHostContentAudit(client, {
      roomId,
      actorId,
      action: "host_unlock_act_scenes",
      targetType: "scene",
      targetId: unlockedSceneIds[0] || null,
      metadata: {
        actKey: actKey || null,
        sequence: sequence ?? null,
        chapterId: chapterId || null,
        unlockedCount: unlockedSceneIds.length,
        sceneIds: unlockedSceneIds
      }
    });
    return { ok: true, unlockedCount: unlockedSceneIds.length, sceneIds: unlockedSceneIds };
  });
}
