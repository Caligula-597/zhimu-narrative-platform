/**
 * B1: Player tasks — world templates + per-room progress.
 */
import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import { resolveSectionSegmentKey } from "./segment-contract.js";

function sanitizeText(value = "", max = 2000) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

export function resolveCurrentActKey(sections = [], segments = []) {
  const segmentByKey = new Map(segments.map((segment) => [segment.segment_key || segment.segmentKey, segment]));
  const segmentByChapterId = new Map(
    segments.filter((segment) => segment.chapter_id || segment.chapterId).map((segment) => [segment.chapter_id || segment.chapterId, segment])
  );
  const keyed = sections.map((section, index) => {
    const fallbackKey = resolveSectionSegmentKey(section, section.sequence || index + 1);
    const segment = segmentByChapterId.get(section.chapter_id || section.chapterId) || segmentByKey.get(fallbackKey);
    return {
      completed: Boolean(section.completed),
      actKey: segment?.segment_key || segment?.segmentKey || fallbackKey
    };
  });
  const incomplete = keyed.find((row) => !row.completed);
  if (incomplete) return incomplete.actKey;
  return keyed[keyed.length - 1]?.actKey || segments[0]?.segment_key || segments[0]?.segmentKey || "ch1";
}

export async function seedPlayerTasksFromArchives(client, worldId, characterArchives, roleKeyToSlotId) {
  if (!characterArchives?.roles?.length) return 0;
  let inserted = 0;
  for (const role of characterArchives.roles) {
    const roleSlotId = roleKeyToSlotId.get(role.key);
    if (!roleSlotId) continue;
    await client.query(`DELETE FROM player_tasks WHERE world_id = $1 AND role_slot_id = $2 AND source = 'matrix_import'`, [
      worldId,
      roleSlotId
    ]);
    for (const actTask of role.actTasks || []) {
      const actKey = actTask.actKey || actTask.act_key;
      if (!actKey) continue;
      const tasks = Array.isArray(actTask.tasks) ? actTask.tasks : [];
      const tips = sanitizeText(actTask.tips, 500) || null;
      let seq = 0;
      for (const taskBody of tasks) {
        const body = sanitizeText(taskBody, 500);
        if (!body) continue;
        seq += 1;
        await client.query(
          `INSERT INTO player_tasks (world_id, role_slot_id, act_key, body, tips, visibility, sequence, source)
           VALUES ($1, $2, $3, $4, $5, 'public', $6, 'matrix_import')`,
          [worldId, roleSlotId, actKey, body, tips, seq]
        );
        inserted += 1;
      }
    }
  }
  return inserted;
}

export async function fetchPlayerTasksForRoom(runQuery, roomId, roleSlotId, actKey) {
  const tasks = await runQuery(
    `SELECT pt.id, pt.act_key, pt.body, pt.tips, pt.visibility, pt.sequence,
            COALESCE(pp.status, 'pending') AS status,
            pp.completed_at
     FROM rooms r
     JOIN player_tasks pt ON pt.world_id = r.world_id AND pt.role_slot_id = $2
     LEFT JOIN player_task_progress pp
       ON pp.player_task_id = pt.id AND pp.room_id = $1 AND pp.role_slot_id = $2
     WHERE r.id = $1 AND pt.act_key = $3
     ORDER BY pt.sequence, pt.created_at`,
    [roomId, roleSlotId, actKey]
  );
  return tasks.rows;
}

export async function completePlayerTask(runQuery, { roomId, roleSlotId, taskId }) {
  const owned = await runQuery(
    `SELECT pt.id
     FROM player_tasks pt
     JOIN rooms r ON r.world_id = pt.world_id AND r.id = $1
     WHERE pt.id = $2 AND pt.role_slot_id = $3`,
    [roomId, taskId, roleSlotId]
  );
  if (!owned.rowCount) throwErr("NOT_FOUND", "Task not found for this role");

  const { rows } = await runQuery(
    `INSERT INTO player_task_progress (room_id, player_task_id, role_slot_id, status, completed_at)
     VALUES ($1, $2, $3, 'completed', now())
     ON CONFLICT (room_id, player_task_id, role_slot_id)
     DO UPDATE SET status = 'completed', completed_at = COALESCE(player_task_progress.completed_at, now())
     RETURNING id, status, completed_at`,
    [roomId, taskId, roleSlotId]
  );
  return rows[0];
}

export async function listWorldPlayerTasks(worldId, roleSlotId = null) {
  const params = [worldId];
  let roleFilter = "";
  if (roleSlotId) {
    params.push(roleSlotId);
    roleFilter = ` AND pt.role_slot_id = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT pt.id, pt.role_slot_id, rs.name AS role_name, pt.act_key, pt.body, pt.tips,
            pt.visibility, pt.sequence, pt.source, pt.created_at
     FROM player_tasks pt
     JOIN role_slots rs ON rs.id = pt.role_slot_id
     WHERE pt.world_id = $1${roleFilter}
     ORDER BY rs.sequence, pt.act_key, pt.sequence`,
    params
  );
  return rows;
}
