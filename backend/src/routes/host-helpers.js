import { assessPlayerProgress, computeMaybeStuck } from "../player-progress-assessment.js";

export { assessPlayerProgress, computeMaybeStuck };

export function summarizeHostAction(action) {
  if (!action?.type) return "未知动作";
  if (action.type === "grant_clue") return `发放线索（角色席位 ${String(action.roleSlotId ?? action.role_slot_id ?? "").slice(0, 8)}…）`;
  if (action.type === "unlock_script_section") return `解锁分幕 ${String(action.scriptSectionId ?? action.script_section_id ?? "").slice(0, 8)}…`;
  if (action.type === "unlock_scene") return `开放场景 ${String(action.sceneId ?? action.scene_id ?? "").slice(0, 8)}…`;
  if (action.type === "timeline_log") return action.message || "写入日志";
  return action.type;
}

export function eventSourceLabel(event) {
  if (event.rule_id) return "自动化规则";
  if (event.event_key?.startsWith("investigation:")) return "调查点";
  if (event.event_key?.startsWith("manual:")) return "主持手动";
  return "系统";
}

export function extractTriggerPlayers(conditions) {
  const all = conditions?.all ?? [];
  const roleIds = all
    .map((condition) => condition.roleSlotId ?? condition.role_slot_id)
    .filter(Boolean);
  return [...new Set(roleIds)];
}

export function eventRelatedRoleIds(event) {
  const ids = new Set((event.trigger_players || []).map(String));
  for (const action of event.actions || []) {
    const rid = action.roleSlotId ?? action.role_slot_id;
    if (rid) ids.add(String(rid));
    for (const r of action.roleSlotIds || action.role_slot_ids || []) ids.add(String(r));
  }
  return [...ids];
}

export async function fetchPlayerHostConfirmStatus(query, roomId, roleSlotId) {
  const result = await query(
    `SELECT phe.title, ar.conditions AS rule_conditions
     FROM pending_host_events phe
     LEFT JOIN automation_rules ar ON ar.id = phe.rule_id
     WHERE phe.room_id = $1 AND phe.status = 'pending'
     ORDER BY phe.created_at`,
    [roomId]
  );
  let waitingForYou = false;
  const titles = [];
  for (const row of result.rows) {
    titles.push(row.title);
    const triggers = extractTriggerPlayers(row.rule_conditions);
    if (!triggers.length || triggers.includes(roleSlotId)) waitingForYou = true;
  }
  return {
    pendingCount: result.rows.length,
    waitingForYou,
    titles: titles.slice(0, 3)
  };
}

export async function fetchHostPlayers(query, roomId) {
  const result = await query(
    `SELECT rs.id AS role_slot_id,
            rs.name AS role_name,
            rs.public_profile,
            rs.private_profile,
            rm.user_id,
            u.display_name AS player_display_name,
            rm.joined_at,
            (rm.user_id IS NOT NULL) AS joined,
            r.status AS room_status,
            ps.current_scene_id,
            COALESCE((ps.variables->>'hostNotes')::text, '') AS host_notes,
            COUNT(DISTINCT ss.id)::int AS total_sections,
            COUNT(DISTINCT ss.id) FILTER (WHERE
              (ss.publication_status = 'published' OR (r.status = 'testing' AND ss.publication_status = 'testing'))
              AND (
                ss.sequence = 1 OR EXISTS (
                  SELECT 1 FROM room_content_unlocks rcu
                  WHERE rcu.room_id = r.id AND rcu.content_type = 'script_section' AND rcu.content_id = ss.id
                )
              )
            )::int AS available_sections,
            COUNT(DISTINCT rp.script_section_id) FILTER (WHERE rp.started_at IS NOT NULL)::int AS started_sections,
            COUNT(DISTINCT rp.script_section_id) FILTER (WHERE rp.completed_at IS NOT NULL)::int AS completed_sections,
            (
              SELECT ss2.title
              FROM reading_progress rp2
              JOIN script_sections ss2 ON ss2.id = rp2.script_section_id
              WHERE rp2.room_id = $1 AND rp2.role_slot_id = rs.id AND rp2.completed_at IS NOT NULL
              ORDER BY rp2.completed_at DESC
              LIMIT 1
            ) AS last_completed_section_title,
            (
              SELECT COUNT(*)::int FROM clue_ownership co
              WHERE co.room_id = $1 AND co.role_slot_id = rs.id
            ) AS clue_count,
            (
              SELECT COUNT(*)::int FROM clue_ownership co
              WHERE co.room_id = $1 AND co.role_slot_id = rs.id AND co.read_at IS NOT NULL
            ) AS read_clue_count,
            (
              SELECT COUNT(*)::int FROM notebook_entries ne
              WHERE ne.room_id = $1 AND ne.role_slot_id = rs.id
            ) AS note_count,
            GREATEST(
              rm.joined_at,
              MAX(GREATEST(rp.started_at, rp.completed_at)),
              (SELECT MAX(GREATEST(co2.acquired_at, co2.read_at)) FROM clue_ownership co2 WHERE co2.room_id = $1 AND co2.role_slot_id = rs.id),
              (SELECT MAX(ir.investigated_at) FROM investigation_records ir WHERE ir.room_id = $1 AND ir.role_slot_id = rs.id),
              (SELECT MAX(ne.created_at) FROM notebook_entries ne WHERE ne.room_id = $1 AND ne.role_slot_id = rs.id)
            ) AS last_activity_at,
            (
              SELECT tl.message
              FROM timeline_logs tl
              LEFT JOIN script_sections ss3 ON ss3.id = NULLIF(tl.metadata->>'sectionId', '')::uuid
              WHERE tl.room_id = $1
                AND (
                  tl.actor_user_id = rm.user_id
                  OR ss3.role_slot_id = rs.id
                )
              ORDER BY tl.created_at DESC
              LIMIT 1
            ) AS last_operation_message,
            (
              SELECT tl.event_type
              FROM timeline_logs tl
              LEFT JOIN script_sections ss4 ON ss4.id = NULLIF(tl.metadata->>'sectionId', '')::uuid
              WHERE tl.room_id = $1
                AND (
                  tl.actor_user_id = rm.user_id
                  OR ss4.role_slot_id = rs.id
                )
              ORDER BY tl.created_at DESC
              LIMIT 1
            ) AS last_operation_type
     FROM role_slots rs
     JOIN rooms r ON r.world_id = rs.world_id
     LEFT JOIN room_members rm ON rm.room_id = r.id AND rm.role_slot_id = rs.id AND rm.status = 'active'
     LEFT JOIN users u ON u.id = rm.user_id
     LEFT JOIN player_states ps ON ps.room_id = r.id AND ps.role_slot_id = rs.id
     LEFT JOIN script_sections ss ON ss.role_slot_id = rs.id
     LEFT JOIN reading_progress rp
       ON rp.script_section_id = ss.id AND rp.room_id = r.id AND rp.role_slot_id = rs.id
     WHERE r.id = $1
     GROUP BY rs.id, rs.name, rs.public_profile, rs.private_profile, r.status,
              rm.user_id, u.display_name, rm.joined_at, rm.status,
              ps.current_scene_id, ps.variables
     ORDER BY rs.sequence, rs.created_at`,
    [roomId]
  );
  return result.rows.map((row) => {
    const assessment = assessPlayerProgress(row);
    return {
      ...row,
      maybe_stuck: assessment.maybeStuck,
      stuck_code: assessment.code,
      stuck_label: assessment.label,
      stuck_detail: assessment.detail,
      recommended_action: assessment.recommendedAction,
      suggested_nudge: assessment.suggestedNudge || null,
      join_label: row.joined ? "已加入" : "席位空置"
    };
  });
}

export async function fetchHostPlayerDetail(query, roomId, roleSlotId) {
  const role = await query(
    `SELECT rs.id, rs.name, rs.public_profile, rs.private_profile,
            rm.user_id, u.display_name AS player_display_name, rm.joined_at,
            r.status AS room_status,
            ps.current_scene_id, COALESCE(ps.variables->>'hostNotes', '') AS host_notes
     FROM role_slots rs
     JOIN rooms r ON r.world_id = rs.world_id
     LEFT JOIN room_members rm ON rm.room_id = r.id AND rm.role_slot_id = rs.id AND rm.status = 'active'
     LEFT JOIN users u ON u.id = rm.user_id
     LEFT JOIN player_states ps ON ps.room_id = r.id AND ps.role_slot_id = rs.id
     WHERE r.id = $1 AND rs.id = $2`,
    [roomId, roleSlotId]
  );
  if (!role.rowCount) return null;

  const [sections, clues, notes, investigations, logs, unlockedScenes] = await Promise.all([
    query(
      `SELECT ss.id, ss.title, ss.sequence, ss.publication_status,
              rp.started_at, rp.completed_at,
              (rp.completed_at IS NOT NULL) AS completed,
              EXISTS (
                SELECT 1 FROM room_content_unlocks rcu
                WHERE rcu.room_id = $1 AND rcu.content_type = 'script_section' AND rcu.content_id = ss.id
              ) AS unlocked
       FROM script_sections ss
       LEFT JOIN reading_progress rp
         ON rp.script_section_id = ss.id AND rp.room_id = $1 AND rp.role_slot_id = $2::uuid
       WHERE ss.role_slot_id = $2::uuid
       ORDER BY ss.sequence`,
      [roomId, roleSlotId]
    ),
    query(
      `SELECT c.id, c.name, c.public_text, co.acquired_at, co.read_at, co.metadata,
              co.shared_with_room, co.player_note, co.host_note, co.shared_at
       FROM clue_ownership co JOIN clues c ON c.id = co.clue_id
       WHERE co.room_id = $1 AND co.role_slot_id = $2::uuid
       ORDER BY co.acquired_at DESC`,
      [roomId, roleSlotId]
    ),
    query(
      `SELECT id, title, body, source_type, created_at
       FROM notebook_entries
       WHERE room_id = $1 AND role_slot_id = $2::uuid
       ORDER BY created_at DESC`,
      [roomId, roleSlotId]
    ),
    query(
      `SELECT ir.investigated_at, ip.name AS point_name, ip.description, s.name AS scene_name
       FROM investigation_records ir
       JOIN investigation_points ip ON ip.id = ir.investigation_point_id
       JOIN scenes s ON s.id = ip.scene_id
       WHERE ir.room_id = $1 AND ir.role_slot_id = $2::uuid
       ORDER BY ir.investigated_at DESC`,
      [roomId, roleSlotId]
    ),
    query(
      `SELECT tl.event_type, tl.message, tl.created_at, tl.metadata, u.display_name AS actor_name
       FROM timeline_logs tl
       LEFT JOIN users u ON u.id = tl.actor_user_id
       LEFT JOIN script_sections ss ON ss.id = NULLIF(tl.metadata->>'sectionId', '')::uuid
       WHERE tl.room_id = $1
         AND (
           tl.metadata->>'roleSlotId' = $2::text
           OR ss.role_slot_id = $2::uuid
           OR tl.actor_user_id = (
             SELECT rm.user_id FROM room_members rm
             WHERE rm.room_id = $1 AND rm.role_slot_id = $2::uuid AND rm.status = 'active'
             LIMIT 1
           )
         )
       ORDER BY tl.created_at DESC
       LIMIT 30`,
      [roomId, roleSlotId]
    ),
    query(
      `SELECT s.id, s.name, rcu.unlocked_at
       FROM room_content_unlocks rcu
       JOIN scenes s ON s.id = rcu.content_id
       WHERE rcu.room_id = $1 AND rcu.content_type = 'scene'
       ORDER BY rcu.unlocked_at`,
      [roomId]
    )
  ]);

  const playerRow = {
    role_slot_id: roleSlotId,
    joined: Boolean(role.rows[0].user_id),
    joined_at: role.rows[0].joined_at,
    room_status: role.rows[0].room_status,
    total_sections: sections.rows.length,
    started_sections: sections.rows.filter((section) => section.started_at).length,
    completed_sections: sections.rows.filter((section) => section.completed).length
  };

  return {
    role: role.rows[0],
    sections: sections.rows,
    clues: clues.rows,
    notes: notes.rows,
    investigations: investigations.rows,
    recentLogs: logs.rows,
    unlockedScenes: unlockedScenes.rows,
    maybe_stuck: computeMaybeStuck({ ...playerRow, last_activity_at: logs.rows[0]?.created_at ?? role.rows[0].joined_at })
  };
}
