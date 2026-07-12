/** Player-home authored/readable content queries. */
import { query } from "../db.js";

const stableContentCache = new Map();
const STABLE_CACHE_MAX = Number(process.env.PLAYER_HOME_STABLE_CACHE_MAX || 500);

async function loadStablePlayerContent({ worldId, roleSlotId, contentRevision }) {
  const key = `${worldId}:${roleSlotId}:${contentRevision}`;
  const cached = stableContentCache.get(key);
  if (cached) return await cached;
  const loading = query(
    `SELECT
       (SELECT jsonb_build_object(
          'id', rs.id, 'name', rs.name, 'public_profile', rs.public_profile,
          'private_profile', rs.private_profile
        ) FROM role_slots rs WHERE rs.id = $2 AND rs.world_id = $1) AS role,
       COALESCE((
         SELECT jsonb_agg(to_jsonb(segment_row) - 'created_at' ORDER BY segment_row.sequence, segment_row.created_at)
         FROM (
           SELECT ws.id, ws.segment_key, ws.title, ws.sequence, ws.chapter_id,
                  ws.story->'playerTasks' AS player_tasks,
                  ws.mechanics->'endCondition' AS end_condition,
                  ws.operations->'playerTips' AS player_tips,
                  ws.created_at
           FROM world_segments ws
           WHERE ws.world_id = $1
         ) segment_row
       ), '[]'::jsonb) AS segments`,
    [worldId, roleSlotId]
  ).then((result) => ({ role: result.rows[0]?.role, segments: result.rows[0]?.segments ?? [] }));
  if (stableContentCache.size >= STABLE_CACHE_MAX) {
    stableContentCache.delete(stableContentCache.keys().next().value);
  }
  stableContentCache.set(key, loading);
  try {
    return await loading;
  } catch (error) {
    if (stableContentCache.get(key) === loading) stableContentCache.delete(key);
    throw error;
  }
}

export function clearPlayerHomeStableContentCache() {
  stableContentCache.clear();
}

export async function loadAuthorizedPlayerHomeContent({ roomId, actorId }) {
  const result = await query(
    `WITH member AS (
       SELECT rm.role_slot_id, r.id AS room_id, r.name AS room_name,
              r.invite_code, r.status AS room_status, r.world_id, w.content_revision
       FROM room_members rm
       JOIN rooms r ON r.id = rm.room_id
       JOIN worlds w ON w.id = r.world_id
       WHERE rm.room_id = $1 AND rm.user_id = $2
         AND rm.status = 'active' AND rm.role_slot_id IS NOT NULL
     )
     SELECT
       m.role_slot_id,
       m.world_id,
       m.content_revision,
       jsonb_build_object(
         'id', m.room_id, 'name', m.room_name,
         'invite_code', m.invite_code, 'status', m.room_status
       ) AS room,
       COALESCE((
         SELECT jsonb_agg(to_jsonb(section_row) ORDER BY section_row.sequence)
         FROM (
           SELECT ss.id, ss.title, ss.body, ss.sequence, ss.chapter_id, ss.metadata,
                  rp.started_at, rp.completed_at,
                  (rp.completed_at IS NOT NULL) AS completed
           FROM script_sections ss
           LEFT JOIN reading_progress rp
             ON rp.script_section_id = ss.id
            AND rp.room_id = m.room_id
            AND rp.role_slot_id = m.role_slot_id
           WHERE ss.role_slot_id = m.role_slot_id
             AND (
               ss.publication_status = 'published'
               OR (m.room_status = 'testing' AND ss.publication_status = 'testing')
             )
             AND (
               ss.sequence = 1 OR EXISTS (
                 SELECT 1 FROM room_content_unlocks rcu
                 WHERE rcu.room_id = m.room_id
                   AND rcu.content_type = 'script_section'
                   AND rcu.content_id = ss.id
               )
             )
         ) section_row
       ), '[]'::jsonb) AS sections
     FROM member m`,
    [roomId, actorId]
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  const stable = await loadStablePlayerContent({
    worldId: row.world_id,
    roleSlotId: row.role_slot_id,
    contentRevision: Number(row.content_revision)
  });
  return {
    roleSlotId: row.role_slot_id,
    worldId: row.world_id,
    contentRevision: Number(row.content_revision),
    room: row.room,
    role: stable.role,
    sections: row.sections ?? [],
    segments: stable.segments
  };
}

export async function loadPlayerHomeContent({ roomId, roleSlotId }) {
  const [snapshot, sections] = await Promise.all([
    query(
      `SELECT
         (SELECT jsonb_build_object(
            'id', r.id, 'name', r.name, 'invite_code', r.invite_code, 'status', r.status
          ) FROM rooms r WHERE r.id = $1) AS room,
         (SELECT jsonb_build_object(
            'id', rs.id, 'name', rs.name, 'public_profile', rs.public_profile,
            'private_profile', rs.private_profile
          ) FROM role_slots rs WHERE rs.id = $2) AS role,
         COALESCE((
           SELECT jsonb_agg(to_jsonb(segment_row) - 'created_at' ORDER BY segment_row.sequence, segment_row.created_at)
           FROM (
             SELECT ws.id, ws.segment_key, ws.title, ws.sequence, ws.chapter_id,
                    ws.story->'playerTasks' AS player_tasks,
                    ws.mechanics->'endCondition' AS end_condition,
                    ws.operations->'playerTips' AS player_tips,
                    ws.created_at
             FROM world_segments ws
             JOIN rooms r ON r.world_id = ws.world_id
             WHERE r.id = $1
           ) segment_row
         ), '[]'::jsonb) AS segments`,
      [roomId, roleSlotId]
    ),
    query(
      `SELECT ss.id, ss.title, ss.body, ss.sequence, ss.chapter_id, ss.metadata,
              rp.started_at, rp.completed_at,
              (rp.completed_at IS NOT NULL) AS completed
       FROM script_sections ss
       JOIN rooms room ON room.id = $1
       LEFT JOIN reading_progress rp
         ON rp.script_section_id = ss.id AND rp.room_id = $1 AND rp.role_slot_id = $2
       WHERE ss.role_slot_id = $2
         AND (
           ss.publication_status = 'published'
           OR (room.status = 'testing' AND ss.publication_status = 'testing')
         )
         AND (
           ss.sequence = 1 OR EXISTS (
             SELECT 1 FROM room_content_unlocks rcu
             WHERE rcu.room_id = $1 AND rcu.content_type = 'script_section' AND rcu.content_id = ss.id
           )
         )
       ORDER BY ss.sequence`,
      [roomId, roleSlotId]
    )
  ]);

  const row = snapshot.rows[0] ?? {};
  return {
    room: row.room,
    role: row.role,
    sections: sections.rows,
    segments: row.segments ?? []
  };
}
