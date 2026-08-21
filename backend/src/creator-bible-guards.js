/**
 * Ensure bible writes only reference entities belonging to the target world.
 */
import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

async function run(client, sql, params) {
  const runner = client?.query ? client.query.bind(client) : query;
  return runner(sql, params);
}

export async function assertRoleSlotInWorld(worldId, roleSlotId, client = null) {
  if (!roleSlotId) return;
  const result = await run(
    client,
    `SELECT 1 FROM role_slots WHERE id = $1 AND world_id = $2`,
    [roleSlotId, worldId]
  );
  if (!result.rowCount) throwErr("ROLE_SLOT_WORLD_MISMATCH");
}

export async function assertRoleSlotsInWorld(worldId, roleSlotIds = [], client = null) {
  const ids = [...new Set((roleSlotIds || []).filter(Boolean))];
  if (!ids.length) return;
  const result = await run(
    client,
    `SELECT count(*)::int AS count FROM role_slots WHERE world_id = $1 AND id = ANY($2::uuid[])`,
    [worldId, ids]
  );
  if (result.rows[0].count !== ids.length) throwErr("ROLE_SLOT_WORLD_MISMATCH");
}

export async function assertChapterInWorld(worldId, chapterId, client = null) {
  if (!chapterId) return;
  const result = await run(
    client,
    `SELECT 1 FROM chapters WHERE id = $1 AND world_id = $2`,
    [chapterId, worldId]
  );
  if (!result.rowCount) throwErr("CHAPTER_NOT_FOUND");
}

export async function assertSceneInWorld(worldId, sceneId, client = null) {
  if (!sceneId) return;
  const result = await run(
    client,
    `SELECT 1 FROM scenes WHERE id = $1 AND world_id = $2`,
    [sceneId, worldId]
  );
  if (!result.rowCount) throwErr("SCENE_WORLD_MISMATCH");
}

export async function assertClueInWorld(worldId, clueId, client = null) {
  if (!clueId) return;
  const result = await run(
    client,
    `SELECT 1 FROM clues WHERE id = $1 AND world_id = $2`,
    [clueId, worldId]
  );
  if (!result.rowCount) throwErr("CLUE_WORLD_MISMATCH");
}

export async function assertSectionInWorld(worldId, sectionId, client = null) {
  if (!sectionId) return;
  const result = await run(
    client,
    `SELECT 1 FROM script_sections ss
     JOIN role_slots rs ON rs.id = ss.role_slot_id
     WHERE ss.id = $1 AND rs.world_id = $2`,
    [sectionId, worldId]
  );
  if (!result.rowCount) throwErr("SCRIPT_SECTION_NOT_FOUND");
}

export async function validateForeshadowRefs(worldId, body, client = null) {
  await assertChapterInWorld(worldId, body.plantChapterId, client);
  await assertChapterInWorld(worldId, body.payoffChapterId, client);
  await assertSectionInWorld(worldId, body.plantSectionId, client);
  await assertSectionInWorld(worldId, body.payoffSectionId, client);
  await assertClueInWorld(worldId, body.clueId, client);
}

export async function validateForeshadowPatch(worldId, patch, client = null) {
  if (patch.plantChapterId !== undefined) await assertChapterInWorld(worldId, patch.plantChapterId, client);
  if (patch.payoffChapterId !== undefined) await assertChapterInWorld(worldId, patch.payoffChapterId, client);
  if (patch.plantSectionId !== undefined) await assertSectionInWorld(worldId, patch.plantSectionId, client);
  if (patch.payoffSectionId !== undefined) await assertSectionInWorld(worldId, patch.payoffSectionId, client);
  if (patch.clueId !== undefined) await assertClueInWorld(worldId, patch.clueId, client);
}

export async function validateTimelineRefs(worldId, body, client = null) {
  await assertChapterInWorld(worldId, body.chapterId, client);
  await assertSceneInWorld(worldId, body.sceneId, client);
  await assertRoleSlotsInWorld(worldId, body.participantRoleIds, client);
}

export async function validateTimelinePatch(worldId, patch, client = null) {
  if (patch.chapterId !== undefined) await assertChapterInWorld(worldId, patch.chapterId, client);
  if (patch.sceneId !== undefined) await assertSceneInWorld(worldId, patch.sceneId, client);
  if (patch.participantRoleIds !== undefined) await assertRoleSlotsInWorld(worldId, patch.participantRoleIds, client);
}

export async function validateCoreTrickRefs(worldId, body, client = null) {
  await assertRoleSlotInWorld(worldId, body.killerRoleSlotId, client);
}

export async function assertCluesInWorld(worldId, clueIds = [], client = null) {
  const ids = [...new Set((clueIds || []).filter(Boolean))];
  if (!ids.length) return;
  const result = await run(
    client,
    `SELECT count(*)::int AS count FROM clues WHERE world_id = $1 AND id = ANY($2::uuid[])`,
    [worldId, ids]
  );
  if (result.rows[0].count !== ids.length) throwErr("CLUE_WORLD_MISMATCH");
}

export async function validateMaterialBookletRefs(worldId, body, client = null) {
  await assertRoleSlotInWorld(worldId, body.ownerRoleSlotId, client);
  await assertChapterInWorld(worldId, body.chapterId, client);
  await assertRoleSlotsInWorld(worldId, body.linkedRoleSlotIds, client);
  await assertCluesInWorld(worldId, body.linkedClueIds, client);
}

export async function validateMaterialBookletPatch(worldId, patch, client = null) {
  if (patch.ownerRoleSlotId !== undefined) await assertRoleSlotInWorld(worldId, patch.ownerRoleSlotId, client);
  if (patch.chapterId !== undefined) await assertChapterInWorld(worldId, patch.chapterId, client);
  if (patch.linkedRoleSlotIds !== undefined) await assertRoleSlotsInWorld(worldId, patch.linkedRoleSlotIds, client);
  if (patch.linkedClueIds !== undefined) await assertCluesInWorld(worldId, patch.linkedClueIds, client);
}
