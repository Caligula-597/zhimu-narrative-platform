import { transaction } from "./db.js";
import { buildWorldSnapshot } from "./world-snapshot-service.js";

export {
  WORLD_ARCHIVE_SNAPSHOT_SQL,
  WORLD_SNAPSHOT_SQL,
  buildWorldArchiveSnapshot,
  buildWorldSnapshot
} from "./world-snapshot-service.js";

function automationRuleHasBrokenReferences(rule, snapshot) {
  const ids = {
    roles: new Set(snapshot.roles.map((item) => item.id)),
    sections: new Set(snapshot.sections.map((item) => item.id)),
    scenes: new Set(snapshot.scenes.map((item) => item.id)),
    clues: new Set(snapshot.clues.map((item) => item.id)),
    points: new Set(snapshot.investigationPoints.map((item) => item.id))
  };
  for (const condition of rule.conditions?.all ?? []) {
    if (condition.roleSlotId && !ids.roles.has(condition.roleSlotId)) return true;
    if (condition.scriptSectionId && !ids.sections.has(condition.scriptSectionId)) return true;
    if (condition.clueId && !ids.clues.has(condition.clueId)) return true;
    if (condition.investigationPointId && !ids.points.has(condition.investigationPointId)) return true;
  }
  for (const action of rule.actions ?? []) {
    if (action.roleSlotId && !ids.roles.has(action.roleSlotId)) return true;
    if (action.scriptSectionId && !ids.sections.has(action.scriptSectionId)) return true;
    if (action.clueId && !ids.clues.has(action.clueId)) return true;
    if (action.sceneId && !ids.scenes.has(action.sceneId)) return true;
  }
  return false;
}

export function findBrokenAutomationRuleIds(snapshot) {
  return snapshot.rules.filter((rule) => automationRuleHasBrokenReferences(rule, snapshot)).map((rule) => rule.id);
}

export async function pruneBrokenAutomationRules(worldId, client = null) {
  const run = async (c) => {
    const snapshot = await buildWorldSnapshot(worldId, c);
    const broken = findBrokenAutomationRuleIds(snapshot);
    if (!broken.length) return 0;
    await c.query(`DELETE FROM automation_rules WHERE world_id = $1 AND id = ANY($2::uuid[])`, [worldId, broken]);
    return broken.length;
  };
  if (client) return run(client);
  return transaction(run);
}

export async function compactChapterSequences(client, worldId) {
  const shifted = await client.query(
    `WITH bounds AS (
       SELECT COALESCE(MAX(sequence), 0)::int + 1 AS offset
       FROM chapters
       WHERE world_id = $1
     )
     UPDATE chapters c
     SET sequence = c.sequence + bounds.offset
     FROM bounds
     WHERE c.world_id = $1
     RETURNING c.id`,
    [worldId]
  );
  if (!shifted.rowCount) return 0;
  await client.query(
    `WITH ranked AS (
       SELECT id, ROW_NUMBER() OVER (ORDER BY sequence, created_at)::int AS new_sequence
       FROM chapters
       WHERE world_id = $1
     )
     UPDATE chapters c
     SET sequence = ranked.new_sequence, updated_at = now()
     FROM ranked
     WHERE c.id = ranked.id`,
    [worldId]
  );
  return shifted.rowCount;
}

export function chapterSequencesNeedRepair(chapterRows) {
  if (!chapterRows.length) return false;
  return chapterRows.some((row, index) => Number(row.sequence) !== index + 1);
}

/** Renumber chapters to 1..N when gaps remain (e.g. prologue deleted before auto-compact existed). */
export async function repairChapterSequencesIfNeeded(worldId, client = null) {
  const run = async (c) => {
    const rows = await c.query(
      `SELECT id, sequence FROM chapters WHERE world_id = $1 ORDER BY sequence, created_at`,
      [worldId]
    );
    if (!chapterSequencesNeedRepair(rows.rows)) return 0;
    return compactChapterSequences(c, worldId);
  };
  if (client) return run(client);
  return transaction(run);
}

/** Delete a public chapter, remove bound role sections + dependent rules, renumber survivors. */
export async function deleteWorldChapter(client, worldId, chapterId) {
  const sectionRows = await client.query(
    `SELECT ss.id FROM script_sections ss
     INNER JOIN role_slots rs ON rs.id = ss.role_slot_id
     WHERE rs.world_id = $1 AND ss.chapter_id = $2`,
    [worldId, chapterId]
  );
  const sectionIds = sectionRows.rows.map((row) => row.id);

  if (sectionIds.length) {
    const rules = await client.query(`SELECT id, conditions, actions FROM automation_rules WHERE world_id = $1`, [worldId]);
    const sectionIdSet = new Set(sectionIds);
    const ruleIdsToDelete = rules.rows.filter((rule) => {
      const conditionHit = (rule.conditions?.all ?? []).some((item) => sectionIdSet.has(item.scriptSectionId));
      const actionHit = (rule.actions ?? []).some((item) => sectionIdSet.has(item.scriptSectionId));
      return conditionHit || actionHit;
    }).map((rule) => rule.id);
    if (ruleIdsToDelete.length) {
      await client.query(`DELETE FROM automation_rules WHERE world_id = $1 AND id = ANY($2::uuid[])`, [worldId, ruleIdsToDelete]);
    }
    await client.query(`DELETE FROM script_sections WHERE id = ANY($1::uuid[])`, [sectionIds]);
  }

  await client.query(
    `DELETE FROM story_graph_edges
     WHERE world_id = $1 AND ((from_type = 'chapter' AND from_id = $2) OR (to_type = 'chapter' AND to_id = $2))`,
    [worldId, chapterId]
  );

  const deleted = await client.query(
    `DELETE FROM chapters WHERE id = $1 AND world_id = $2 RETURNING id`,
    [chapterId, worldId]
  );
  if (!deleted.rowCount) return null;

  await compactChapterSequences(client, worldId);
  await pruneBrokenAutomationRules(worldId, client);
  return { deletedId: chapterId, sectionsRemoved: sectionIds.length };
}
