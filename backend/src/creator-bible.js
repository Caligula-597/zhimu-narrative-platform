/**
 * Creator bible — row mappers and summary aggregation for structural story objects.
 */
import { query } from "./db.js";

function coreTrickRow(row) {
  if (!row) return null;
  return {
    worldId: row.world_id,
    summary: row.summary,
    killerRoleSlotId: row.killer_role_slot_id,
    method: row.method,
    motive: row.motive,
    victim: row.victim,
    hostNotes: row.host_notes,
    metadata: row.metadata || {},
    updatedAt: row.updated_at
  };
}

function roleArchiveRow(row) {
  return {
    id: row.id,
    worldId: row.world_id,
    roleSlotId: row.role_slot_id,
    roleName: row.role_name || null,
    publicIdentity: row.public_identity,
    hiddenIdentity: row.hidden_identity,
    externalGoal: row.external_goal,
    internalNeed: row.internal_need,
    secret: row.secret,
    actionLine: row.action_line,
    innerConflict: row.inner_conflict,
    voiceHints: row.voice_hints,
    arc: row.arc || {},
    lies: row.lies || [],
    actTasks: row.act_tasks || [],
    metadata: row.metadata || {},
    updatedAt: row.updated_at
  };
}

function foreshadowRow(row) {
  return {
    id: row.id,
    worldId: row.world_id,
    title: row.title,
    plantSummary: row.plant_summary,
    surfaceMeaning: row.surface_meaning,
    trueMeaning: row.true_meaning,
    payoffSummary: row.payoff_summary,
    sequence: row.sequence,
    plantChapterId: row.plant_chapter_id,
    payoffChapterId: row.payoff_chapter_id,
    plantSectionId: row.plant_section_id,
    payoffSectionId: row.payoff_section_id,
    clueId: row.clue_id,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function timelineEventRow(row) {
  return {
    id: row.id,
    worldId: row.world_id,
    timeLabel: row.time_label,
    eventSummary: row.event_summary,
    sequence: row.sequence,
    chapterId: row.chapter_id,
    sceneId: row.scene_id,
    participantRoleIds: row.participant_role_ids || [],
    alibiNotes: row.alibi_notes,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function loadBibleSummary(worldId) {
  const [core, archives, foreshadow, timeline, claims, rels, segments, cluesByKind, brief] = await Promise.all([
    query(`SELECT summary, method FROM world_core_tricks WHERE world_id = $1`, [worldId]),
    query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE external_goal <> '' OR secret <> '')::int AS filled
       FROM world_role_archives WHERE world_id = $1`,
      [worldId]
    ),
    query(`SELECT count(*)::int AS count FROM world_foreshadow_beats WHERE world_id = $1`, [worldId]),
    query(`SELECT count(*)::int AS count FROM world_timeline_events WHERE world_id = $1`, [worldId]),
    query(`SELECT count(*)::int AS count FROM world_truth_claims WHERE world_id = $1`, [worldId]),
    query(`SELECT count(*)::int AS count FROM world_role_relationships WHERE world_id = $1`, [worldId]),
    query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE coalesce(operations->>'flow', '') <> '' OR coalesce(operations->>'hostTruth', '') <> '')::int AS with_flow
       FROM world_segments WHERE world_id = $1`,
      [worldId]
    ),
    query(
      `SELECT clue_kind, count(*)::int AS count FROM clues WHERE world_id = $1 GROUP BY clue_kind`,
      [worldId]
    ),
    query(`SELECT summary, settings FROM worlds WHERE id = $1`, [worldId])
  ]);

  const world = brief.rows[0] || {};
  const creatorBrief = world.settings?.creatorBrief || {};
  const sellingFilled = (creatorBrief.sellingPoints || []).filter(Boolean).length;
  const positioningFilled = [creatorBrief.target, creatorBrief.duration, creatorBrief.type].filter(Boolean).length;
  const sparks = Array.isArray(creatorBrief.sparks) ? creatorBrief.sparks.length : 0;
  const loglineChars = String(world.summary || "").trim().length;
  const coreRow = core.rows[0];
  const cluesMap = Object.fromEntries((cluesByKind.rows || []).map((r) => [r.clue_kind, r.count]));

  return {
    counts: {
      sparks,
      loglineChars,
      sellingFilled,
      positioningFilled,
      coreTrick: coreRow && (coreRow.summary || coreRow.method) ? 1 : 0,
      truthClaims: claims.rows[0]?.count || 0,
      relationships: rels.rows[0]?.count || 0,
      timelineEvents: timeline.rows[0]?.count || 0,
      roleArchives: archives.rows[0]?.total || 0,
      roleArchivesFilled: archives.rows[0]?.filled || 0,
      roleArcs: archives.rows[0]?.total || 0,
      foreshadowBeats: foreshadow.rows[0]?.count || 0,
      segments: segments.rows[0]?.total || 0,
      segmentsWithFlow: segments.rows[0]?.with_flow || 0,
      cluesByKind: cluesMap
    }
  };
}

export async function getCoreTrick(worldId) {
  const result = await query(`SELECT * FROM world_core_tricks WHERE world_id = $1`, [worldId]);
  return coreTrickRow(result.rows[0]);
}

export async function upsertCoreTrick(worldId, body) {
  const result = await query(
    `INSERT INTO world_core_tricks
      (world_id, summary, killer_role_slot_id, method, motive, victim, host_notes, metadata, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now())
     ON CONFLICT (world_id) DO UPDATE SET
       summary = EXCLUDED.summary,
       killer_role_slot_id = EXCLUDED.killer_role_slot_id,
       method = EXCLUDED.method,
       motive = EXCLUDED.motive,
       victim = EXCLUDED.victim,
       host_notes = EXCLUDED.host_notes,
       metadata = EXCLUDED.metadata,
       updated_at = now()
     RETURNING *`,
    [
      worldId,
      body.summary || "",
      body.killerRoleSlotId || null,
      body.method || "",
      body.motive || "",
      body.victim || "",
      body.hostNotes || "",
      JSON.stringify(body.metadata || {})
    ]
  );
  return coreTrickRow(result.rows[0]);
}

export async function listRoleArchives(worldId) {
  const result = await query(
    `SELECT wra.*, rs.name AS role_name
     FROM world_role_archives wra
     JOIN role_slots rs ON rs.id = wra.role_slot_id
     WHERE wra.world_id = $1
     ORDER BY rs.sequence, rs.name`,
    [worldId]
  );
  return result.rows.map(roleArchiveRow);
}

export async function getRoleArchive(worldId, roleSlotId) {
  const result = await query(
    `SELECT wra.*, rs.name AS role_name
     FROM world_role_archives wra
     JOIN role_slots rs ON rs.id = wra.role_slot_id
     WHERE wra.world_id = $1 AND wra.role_slot_id = $2`,
    [worldId, roleSlotId]
  );
  return roleArchiveRow(result.rows[0]);
}

export async function upsertRoleArchive(worldId, roleSlotId, body) {
  const result = await query(
    `INSERT INTO world_role_archives
      (world_id, role_slot_id, public_identity, hidden_identity, external_goal, internal_need,
       secret, action_line, inner_conflict, voice_hints, arc, lies, act_tasks, metadata, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, now())
     ON CONFLICT (role_slot_id) DO UPDATE SET
       public_identity = EXCLUDED.public_identity,
       hidden_identity = EXCLUDED.hidden_identity,
       external_goal = EXCLUDED.external_goal,
       internal_need = EXCLUDED.internal_need,
       secret = EXCLUDED.secret,
       action_line = EXCLUDED.action_line,
       inner_conflict = EXCLUDED.inner_conflict,
       voice_hints = EXCLUDED.voice_hints,
       arc = EXCLUDED.arc,
       lies = EXCLUDED.lies,
       act_tasks = EXCLUDED.act_tasks,
       metadata = EXCLUDED.metadata,
       updated_at = now()
     RETURNING *`,
    [
      worldId,
      roleSlotId,
      body.publicIdentity || "",
      body.hiddenIdentity || "",
      body.externalGoal || "",
      body.internalNeed || "",
      body.secret || "",
      body.actionLine || "",
      body.innerConflict || "",
      body.voiceHints || "",
      JSON.stringify(body.arc || {}),
      JSON.stringify(body.lies || []),
      JSON.stringify(body.actTasks || []),
      JSON.stringify(body.metadata || {})
    ]
  );
  const row = result.rows[0];
  const nameResult = await query(`SELECT name FROM role_slots WHERE id = $1`, [roleSlotId]);
  row.role_name = nameResult.rows[0]?.name;
  return roleArchiveRow(row);
}

export async function listForeshadowBeats(worldId) {
  const result = await query(
    `SELECT * FROM world_foreshadow_beats WHERE world_id = $1 ORDER BY sequence, created_at`,
    [worldId]
  );
  return result.rows.map(foreshadowRow);
}

export async function createForeshadowBeat(worldId, body) {
  const result = await query(
    `INSERT INTO world_foreshadow_beats
      (world_id, title, plant_summary, surface_meaning, true_meaning, payoff_summary, sequence,
       plant_chapter_id, payoff_chapter_id, plant_section_id, payoff_section_id, clue_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
     RETURNING *`,
    [
      worldId,
      body.title || "",
      body.plantSummary || "",
      body.surfaceMeaning || "",
      body.trueMeaning || "",
      body.payoffSummary || "",
      body.sequence || 1,
      body.plantChapterId || null,
      body.payoffChapterId || null,
      body.plantSectionId || null,
      body.payoffSectionId || null,
      body.clueId || null,
      JSON.stringify(body.metadata || {})
    ]
  );
  return foreshadowRow(result.rows[0]);
}

export async function updateForeshadowBeat(worldId, beatId, body) {
  const result = await query(
    `UPDATE world_foreshadow_beats SET
       title = COALESCE($3, title),
       plant_summary = COALESCE($4, plant_summary),
       surface_meaning = COALESCE($5, surface_meaning),
       true_meaning = COALESCE($6, true_meaning),
       payoff_summary = COALESCE($7, payoff_summary),
       sequence = COALESCE($8, sequence),
       plant_chapter_id = COALESCE($9, plant_chapter_id),
       payoff_chapter_id = COALESCE($10, payoff_chapter_id),
       plant_section_id = COALESCE($11, plant_section_id),
       payoff_section_id = COALESCE($12, payoff_section_id),
       clue_id = COALESCE($13, clue_id),
       metadata = COALESCE($14::jsonb, metadata),
       updated_at = now()
     WHERE id = $1 AND world_id = $2
     RETURNING *`,
    [
      beatId,
      worldId,
      body.title,
      body.plantSummary,
      body.surfaceMeaning,
      body.trueMeaning,
      body.payoffSummary,
      body.sequence,
      body.plantChapterId,
      body.payoffChapterId,
      body.plantSectionId,
      body.payoffSectionId,
      body.clueId,
      body.metadata != null ? JSON.stringify(body.metadata) : null
    ]
  );
  return foreshadowRow(result.rows[0]);
}

export async function deleteForeshadowBeat(worldId, beatId) {
  const result = await query(
    `DELETE FROM world_foreshadow_beats WHERE id = $1 AND world_id = $2 RETURNING id`,
    [beatId, worldId]
  );
  return result.rowCount > 0;
}

export async function listTimelineEvents(worldId) {
  const result = await query(
    `SELECT * FROM world_timeline_events WHERE world_id = $1 ORDER BY sequence, created_at`,
    [worldId]
  );
  return result.rows.map(timelineEventRow);
}

export async function createTimelineEvent(worldId, body) {
  const result = await query(
    `INSERT INTO world_timeline_events
      (world_id, time_label, event_summary, sequence, chapter_id, scene_id, participant_role_ids, alibi_notes, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7::uuid[],$8,$9::jsonb)
     RETURNING *`,
    [
      worldId,
      body.timeLabel || "",
      body.eventSummary || "",
      body.sequence || 1,
      body.chapterId || null,
      body.sceneId || null,
      body.participantRoleIds || [],
      body.alibiNotes || "",
      JSON.stringify(body.metadata || {})
    ]
  );
  return timelineEventRow(result.rows[0]);
}

export async function updateTimelineEvent(worldId, eventId, body) {
  const result = await query(
    `UPDATE world_timeline_events SET
       time_label = COALESCE($3, time_label),
       event_summary = COALESCE($4, event_summary),
       sequence = COALESCE($5, sequence),
       chapter_id = COALESCE($6, chapter_id),
       scene_id = COALESCE($7, scene_id),
       participant_role_ids = COALESCE($8::uuid[], participant_role_ids),
       alibi_notes = COALESCE($9, alibi_notes),
       metadata = COALESCE($10::jsonb, metadata),
       updated_at = now()
     WHERE id = $1 AND world_id = $2
     RETURNING *`,
    [
      eventId,
      worldId,
      body.timeLabel,
      body.eventSummary,
      body.sequence,
      body.chapterId,
      body.sceneId,
      body.participantRoleIds,
      body.alibiNotes,
      body.metadata != null ? JSON.stringify(body.metadata) : null
    ]
  );
  return timelineEventRow(result.rows[0]);
}

export async function deleteTimelineEvent(worldId, eventId) {
  const result = await query(
    `DELETE FROM world_timeline_events WHERE id = $1 AND world_id = $2 RETURNING id`,
    [eventId, worldId]
  );
  return result.rowCount > 0;
}

/** Matrix / pipeline import — populate bible tables (idempotent per source tag). */
export async function seedBibleFromPipeline(client, worldId, pipeline, roleKeyToSlotId) {
  const stats = { coreTrick: 0, roleArchives: 0, timelineEvents: 0, foreshadowBeats: 0 };
  const tb = pipeline?.truthBible;
  if (tb && typeof tb === "object") {
    await client.query(
      `INSERT INTO world_core_tricks
        (world_id, summary, method, motive, victim, host_notes, metadata, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
       ON CONFLICT (world_id) DO UPDATE SET
         summary = EXCLUDED.summary,
         method = EXCLUDED.method,
         motive = EXCLUDED.motive,
         victim = EXCLUDED.victim,
         host_notes = EXCLUDED.host_notes,
         metadata = EXCLUDED.metadata,
         updated_at = now()`,
      [
        worldId,
        String(tb.summary || "").slice(0, 12000),
        String(tb.method || "").slice(0, 12000),
        String(tb.motive || "").slice(0, 12000),
        String(tb.victim || "").slice(0, 500),
        String(tb.hostNotes || "").slice(0, 12000),
        JSON.stringify({ source: "matrix_import" })
      ]
    );
    stats.coreTrick = 1;

    await client.query(
      `DELETE FROM world_timeline_events WHERE world_id = $1 AND metadata->>'source' = 'matrix_import'`,
      [worldId]
    );
    const timeline = Array.isArray(tb.physicalTimeline) ? tb.physicalTimeline : Array.isArray(tb.timeline) ? tb.timeline : [];
    for (const [index, row] of timeline.entries()) {
      await client.query(
        `INSERT INTO world_timeline_events
          (world_id, time_label, event_summary, sequence, alibi_notes, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          worldId,
          String(row.time || row.timeLabel || "").slice(0, 120),
          String(row.event || row.eventSummary || "").slice(0, 4000),
          index + 1,
          Array.isArray(row.participants) ? row.participants.join("、").slice(0, 4000) : "",
          JSON.stringify({ source: "matrix_import", participants: row.participants || [] })
        ]
      );
      stats.timelineEvents += 1;
    }

    await client.query(
      `DELETE FROM world_foreshadow_beats WHERE world_id = $1 AND metadata->>'source' = 'matrix_import'`,
      [worldId]
    );
    for (const [index, row] of (tb.misdirections || []).entries()) {
      await client.query(
        `INSERT INTO world_foreshadow_beats
          (world_id, title, plant_summary, surface_meaning, true_meaning, payoff_summary, sequence, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          worldId,
          String(row.surface || `误导层 ${index + 1}`).slice(0, 200),
          String(row.misleading || "").slice(0, 4000),
          String(row.surface || "").slice(0, 4000),
          String(row.misleading || "").slice(0, 4000),
          String(row.resolution || "").slice(0, 4000),
          Number(row.layer) || index + 1,
          JSON.stringify({ source: "matrix_import" })
        ]
      );
      stats.foreshadowBeats += 1;
    }
  }

  for (const role of pipeline?.characterArchives?.roles || []) {
    const roleSlotId = roleKeyToSlotId.get(role.key);
    if (!roleSlotId) continue;
    await client.query(
      `INSERT INTO world_role_archives
        (world_id, role_slot_id, public_identity, hidden_identity, external_goal, internal_need,
         secret, action_line, inner_conflict, voice_hints, arc, lies, act_tasks, metadata, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, now())
       ON CONFLICT (role_slot_id) DO UPDATE SET
         public_identity = EXCLUDED.public_identity,
         hidden_identity = EXCLUDED.hidden_identity,
         external_goal = EXCLUDED.external_goal,
         internal_need = EXCLUDED.internal_need,
         secret = EXCLUDED.secret,
         action_line = EXCLUDED.action_line,
         inner_conflict = EXCLUDED.inner_conflict,
         voice_hints = EXCLUDED.voice_hints,
         lies = EXCLUDED.lies,
         act_tasks = EXCLUDED.act_tasks,
         metadata = EXCLUDED.metadata,
         updated_at = now()`,
      [
        worldId,
        roleSlotId,
        String(role.publicIdentity || role.publicProfile || "").slice(0, 4000),
        String(role.hiddenIdentity || "").slice(0, 8000),
        String(role.motive || "").slice(0, 4000),
        String(role.innerConflict || "").slice(0, 4000),
        (role.lies || [])[0] ? String(role.lies[0]).slice(0, 8000) : "",
        String(role.timelineActions || "").slice(0, 8000),
        String(role.innerConflict || "").slice(0, 4000),
        String(role.voiceHints || "").slice(0, 4000),
        JSON.stringify({}),
        JSON.stringify(Array.isArray(role.lies) ? role.lies : []),
        JSON.stringify(Array.isArray(role.actTasks) ? role.actTasks : []),
        JSON.stringify({ source: "matrix_import", relationships: role.relationships || "" })
      ]
    );
    stats.roleArchives += 1;
  }

  return stats;
}
