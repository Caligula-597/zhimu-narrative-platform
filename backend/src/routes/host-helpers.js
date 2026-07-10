const STUCK_IDLE_MS = 45 * 60 * 1000;
const STUCK_OPENING_MS = 30 * 60 * 1000;
const STUCK_NO_CONTENT_MS = 5 * 60 * 1000;

function timestamp(value) {
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function assessPlayerProgress(player, now = Date.now()) {
  if (!player.joined) {
    return { maybeStuck: false, code: "empty", label: "席位空置", detail: "等待玩家加入", recommendedAction: "invite" };
  }
  if (!["active", "testing"].includes(player.room_status || "active")) {
    const paused = player.room_status === "paused";
    return {
      maybeStuck: false,
      code: paused ? "room_paused" : "room_inactive",
      label: paused ? "房间暂停" : "本局已结束",
      detail: paused ? "暂停期间不计入卡关" : "无需现场干预",
      recommendedAction: "none"
    };
  }

  const total = Number(player.total_sections) || 0;
  const available = player.available_sections == null ? total : Number(player.available_sections) || 0;
  const completed = Number(player.completed_sections) || 0;
  const started = Number(player.started_sections) || 0;
  const unreadClues = Math.max(0, (Number(player.clue_count) || 0) - (Number(player.read_clue_count) || 0));
  const joinedAt = timestamp(player.joined_at);
  const lastAt = timestamp(player.last_activity_at) ?? joinedAt;
  const joinedFor = joinedAt == null ? 0 : now - joinedAt;
  const idleFor = lastAt == null ? 0 : now - lastAt;

  if (total > 0 && completed >= total) {
    return { maybeStuck: false, code: "complete", label: "阅读完成", detail: "全部分幕已完成", recommendedAction: "none" };
  }
  if (available === 0 && joinedFor >= STUCK_NO_CONTENT_MS) {
    return {
      maybeStuck: true,
      code: "no_content",
      label: "无可读内容",
      detail: "入房后仍没有角色分幕",
      recommendedAction: "unlock_section",
      suggestedNudge: "正在为你准备角色内容，请稍候；主持人会尽快确认分幕配置。"
    };
  }
  if (available > 0 && available < total && completed >= available && idleFor >= STUCK_IDLE_MS) {
    return {
      maybeStuck: true,
      code: "waiting_unlock",
      label: "等待新分幕",
      detail: `已完成当前 ${available} 个可读分幕，仍有内容尚未解锁`,
      recommendedAction: "unlock_section",
      suggestedNudge: "你已完成当前开放内容，主持人正在确认下一阶段；新分幕解锁后会自动出现。"
    };
  }
  if (completed === 0 && started === 0 && joinedFor >= STUCK_OPENING_MS) {
    return {
      maybeStuck: true,
      code: "opening_not_started",
      label: "尚未开始首幕",
      detail: "入房超过 30 分钟仍未开始阅读",
      recommendedAction: "nudge",
      suggestedNudge: "可以先打开「剧情」阅读第一幕；如果看不到内容，请告诉主持人。"
    };
  }
  if (completed === 0 && started > 0 && idleFor >= STUCK_IDLE_MS) {
    return {
      maybeStuck: true,
      code: "opening_abandoned",
      label: "首幕阅读停滞",
      detail: "已开始首幕，但超过 45 分钟没有推进",
      recommendedAction: "inspect",
      suggestedNudge: "第一幕还没有读完；如果角色目标或文本不清楚，可以直接告诉主持人。"
    };
  }
  if (total > completed && idleFor >= STUCK_IDLE_MS) {
    if (unreadClues > 0) {
      return {
        maybeStuck: true,
        code: "unread_clues",
        label: "有未读线索",
        detail: `${unreadClues} 条线索尚未阅读，且超过 45 分钟未推进`,
        recommendedAction: "nudge",
        suggestedNudge: "你有新的未读线索，可以先到「调查 → 线索」查看，再决定下一步。"
      };
    }
    return {
      maybeStuck: true,
      code: "progress_idle",
      label: "剧情推进停滞",
      detail: "超过 45 分钟没有新的阅读、调查或笔记",
      recommendedAction: "inspect",
      suggestedNudge: "当前剧情似乎停住了；可以查看「现在」页的建议下一步，或联系主持人获取提示。"
    };
  }
  return {
    maybeStuck: false,
    code: "active",
    label: completed || started ? "进行中" : "刚加入",
    detail: completed || started ? "最近仍有有效推进" : "尚在开场缓冲期",
    recommendedAction: "none"
  };
}

export function computeMaybeStuck(player, now = Date.now()) {
  return assessPlayerProgress(player, now).maybeStuck;
}

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
