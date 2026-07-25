import { query } from "../db.js";

export async function configurePlayerProgressTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '30000ms', true)`
  );
}

export async function startReadableSection({ roomId, roleSlotId, sectionId }) {
  const result = await query(
    `INSERT INTO reading_progress (room_id, role_slot_id, script_section_id, started_at)
     SELECT $1, $3, ss.id, now()
     FROM script_sections ss
     JOIN rooms room ON room.id = $1
     WHERE ss.id = $2
       AND ss.role_slot_id = $3
       AND (
         ss.publication_status = 'published'
         OR (room.status = 'testing' AND ss.publication_status = 'testing')
       )
       AND (
         ss.sequence = 1 OR EXISTS (
           SELECT 1
           FROM room_content_unlocks rcu
           WHERE rcu.room_id = $1
             AND rcu.content_type = 'script_section'
             AND rcu.content_id = ss.id
         )
       )
     ON CONFLICT (room_id, role_slot_id, script_section_id)
     DO UPDATE SET started_at = COALESCE(reading_progress.started_at, EXCLUDED.started_at)
     RETURNING started_at, completed_at`,
    [roomId, sectionId, roleSlotId]
  );
  return result.rows[0] ?? null;
}

export async function startReadingProgress(client, { roomId, roleSlotId, sectionId }) {
  const result = await client.query(
    `INSERT INTO reading_progress (room_id, role_slot_id, script_section_id, started_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (room_id, role_slot_id, script_section_id)
     DO UPDATE SET started_at = COALESCE(reading_progress.started_at, EXCLUDED.started_at)
     RETURNING started_at, completed_at`,
    [roomId, roleSlotId, sectionId]
  );
  return result.rows[0] ?? null;
}

export async function findReadableSection(client, { roomId, roleSlotId, sectionId }) {
  const result = await client.query(
    `SELECT ss.id
     FROM script_sections ss
     JOIN rooms room ON room.id = $1
     WHERE ss.id = $2
       AND ss.role_slot_id = $3
       AND (
         ss.publication_status = 'published'
         OR (room.status = 'testing' AND ss.publication_status = 'testing')
       )
       AND (
         ss.sequence = 1 OR EXISTS (
           SELECT 1
           FROM room_content_unlocks rcu
           WHERE rcu.room_id = $1
             AND rcu.content_type = 'script_section'
             AND rcu.content_id = ss.id
         )
       )`,
    [roomId, sectionId, roleSlotId]
  );
  return result.rows[0] ?? null;
}

export async function completeReadingProgress(client, { roomId, roleSlotId, sectionId }) {
  const inserted = await client.query(
    `INSERT INTO reading_progress
       (room_id, role_slot_id, script_section_id, started_at, completed_at)
     VALUES ($1, $2, $3, now(), now())
     ON CONFLICT (room_id, role_slot_id, script_section_id) DO NOTHING
     RETURNING started_at, completed_at`,
    [roomId, roleSlotId, sectionId]
  );
  if (inserted.rowCount) {
    return { ...inserted.rows[0], newlyCompleted: true };
  }

  const completed = await client.query(
    `UPDATE reading_progress
     SET started_at = COALESCE(started_at, now()),
         completed_at = now()
     WHERE room_id = $1
       AND role_slot_id = $2
       AND script_section_id = $3
       AND completed_at IS NULL
     RETURNING started_at, completed_at`,
    [roomId, roleSlotId, sectionId]
  );
  if (completed.rowCount) {
    return { ...completed.rows[0], newlyCompleted: true };
  }

  const existing = await client.query(
    `SELECT started_at, completed_at
     FROM reading_progress
     WHERE room_id = $1 AND role_slot_id = $2 AND script_section_id = $3`,
    [roomId, roleSlotId, sectionId]
  );
  return existing.rowCount ? { ...existing.rows[0], newlyCompleted: false } : null;
}

export async function insertReadingCompletedTimeline(client, { roomId, actorId, sectionId }) {
  await client.query(
    `INSERT INTO timeline_logs
       (room_id, actor_user_id, visibility, event_type, message, metadata)
     VALUES (
       $1, $2, 'host', 'reading_completed', '玩家完成一段角色阅读',
       jsonb_build_object('sectionId', $3::text)
     )`,
    [roomId, actorId, sectionId]
  );
}

export async function insertMiniGameTimeline(client, {
  roomId,
  actorId,
  gameId,
  correct,
  completed
}) {
  await client.query(
    `INSERT INTO timeline_logs
       (room_id, actor_user_id, visibility, event_type, message, metadata)
     VALUES (
       $1, $2, 'public', $3, $4,
       jsonb_build_object('gameId', $5::text, 'correct', $6::boolean)
     )`,
    [
      roomId,
      actorId,
      completed ? "mini_game_completed" : "mini_game_submitted",
      correct ? "玩家解开小游戏机关" : "玩家尝试小游戏机关",
      gameId,
      correct
    ]
  );
}

export async function isNotebookSourceAvailable(client, {
  roomId,
  roleSlotId,
  sourceType,
  sourceId
}) {
  if (sourceType === "manual") return sourceId == null;
  if (!sourceId) return false;

  if (sourceType === "script_section") {
    return Boolean(await findReadableSection(client, {
      roomId,
      roleSlotId,
      sectionId: sourceId
    }));
  }

  if (sourceType === "clue") {
    const result = await client.query(
      `SELECT 1
       FROM clue_ownership
       WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3`,
      [roomId, roleSlotId, sourceId]
    );
    return result.rowCount > 0;
  }

  return false;
}

export async function createNotebookEntry(client, {
  roomId,
  roleSlotId,
  actorId,
  sourceType,
  sourceId,
  title,
  body
}) {
  const result = await client.query(
    `INSERT INTO notebook_entries
       (room_id, role_slot_id, created_by_user_id, source_type, source_id, title, body)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [roomId, roleSlotId, actorId, sourceType, sourceId ?? null, title, body]
  );
  return result.rows[0];
}

export async function deleteNotebookEntry({ roomId, roleSlotId, entryId }) {
  const result = await query(
    `DELETE FROM notebook_entries
     WHERE id = $1 AND room_id = $2 AND role_slot_id = $3
     RETURNING id`,
    [entryId, roomId, roleSlotId]
  );
  return result.rows[0] ?? null;
}

export async function listPlayerTimeline({ roomId, actorId }) {
  const result = await query(
    `SELECT id, event_type, message, metadata, visibility, created_at,
            (actor_user_id = $2) AS is_self
     FROM timeline_logs
     WHERE room_id = $1
       AND (visibility IN ('public', 'player') OR actor_user_id = $2)
     ORDER BY created_at DESC
     LIMIT 60`,
    [roomId, actorId]
  );
  return result.rows;
}
