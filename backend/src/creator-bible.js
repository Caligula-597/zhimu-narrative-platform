/**
 * Creator bible — row mappers and summary aggregation for structural story objects.
 */
import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import {
  assertRoleSlotInWorld,
  validateCoreTrickRefs,
  validateForeshadowPatch,
  validateForeshadowRefs,
  validateMaterialBookletPatch,
  validateMaterialBookletRefs,
  validateTimelinePatch,
  validateTimelineRefs
} from "./creator-bible-guards.js";
import {
  mergeCoreTrickPatch,
  mergeRoleArchivePatch,
  normalizeCoreTrickBody,
  normalizeForeshadowBody,
  normalizeMaterialBookletBody,
  normalizeRoleArchiveBody,
  normalizeTimelineEventBody
} from "./creator-bible-contract.js";

function run(client) {
  return client?.query ? client.query.bind(client) : query;
}

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
  if (!row) return null;
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
    appearanceStates: row.appearance_states || [],
    metadata: row.metadata || {},
    updatedAt: row.updated_at
  };
}

function foreshadowRow(row) {
  if (!row) return null;
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
  if (!row) return null;
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

export const BIBLE_SUMMARY_SQL = `
  SELECT
       (SELECT summary FROM world_core_tricks WHERE world_id = $1) AS core_summary,
       (SELECT method FROM world_core_tricks WHERE world_id = $1) AS core_method,
       (SELECT count(*)::int FROM world_role_archives WHERE world_id = $1) AS archives_total,
       (SELECT count(*) FILTER (WHERE external_goal <> '' OR secret <> '')::int FROM world_role_archives WHERE world_id = $1) AS archives_filled,
       (SELECT count(*)::int FROM world_foreshadow_beats WHERE world_id = $1) AS foreshadow_count,
       (SELECT count(*)::int FROM world_material_booklets WHERE world_id = $1) AS material_booklet_count,
       (SELECT count(*)::int FROM world_timeline_events WHERE world_id = $1) AS timeline_count,
       (SELECT count(*)::int FROM world_truth_claims WHERE world_id = $1) AS claims_count,
       (SELECT count(*)::int FROM world_role_relationships WHERE world_id = $1) AS relationships_count,
       (SELECT count(*)::int FROM world_segments WHERE world_id = $1) AS segments_total,
       (SELECT count(*) FILTER (
          WHERE coalesce(operations->>'flow', '') <> '' OR coalesce(operations->>'hostTruth', '') <> ''
        )::int FROM world_segments WHERE world_id = $1) AS segments_with_flow,
       COALESCE((
         SELECT jsonb_object_agg(grouped.clue_kind, grouped.count)
         FROM (
           SELECT clue_kind, count(*)::int AS count
           FROM clues WHERE world_id = $1 GROUP BY clue_kind
         ) grouped
       ), '{}'::jsonb) AS clues_by_kind,
       (SELECT summary FROM worlds WHERE id = $1) AS world_summary,
       (SELECT settings FROM worlds WHERE id = $1) AS world_settings`;

export function bibleSummaryFromRow(row = {}) {
  const world = { summary: row.world_summary, settings: row.world_settings };
  const creatorBrief = world.settings?.creatorBrief || {};
  const sellingFilled = (creatorBrief.sellingPoints || []).filter(Boolean).length;
  const positioningFilled = [creatorBrief.target, creatorBrief.duration, creatorBrief.type].filter(Boolean).length;
  const sparks = Array.isArray(creatorBrief.sparks) ? creatorBrief.sparks.length : 0;
  const loglineChars = String(world.summary || "").trim().length;
  const coreFilled = Boolean(row.core_summary || row.core_method);
  const cluesMap = row.clues_by_kind || {};

  return {
    counts: {
      sparks,
      loglineChars,
      sellingFilled,
      positioningFilled,
      coreTrick: coreFilled ? 1 : 0,
      truthClaims: row.claims_count || 0,
      relationships: row.relationships_count || 0,
      timelineEvents: row.timeline_count || 0,
      roleArchives: row.archives_total || 0,
      roleArchivesFilled: row.archives_filled || 0,
      roleArcs: row.archives_total || 0,
      foreshadowBeats: row.foreshadow_count || 0,
      materialBooklets: row.material_booklet_count || 0,
      segments: row.segments_total || 0,
      segmentsWithFlow: row.segments_with_flow || 0,
      cluesByKind: cluesMap
    }
  };
}

export async function loadBibleSummary(worldId, client = null) {
  const result = await run(client)(BIBLE_SUMMARY_SQL, [worldId]);
  return bibleSummaryFromRow(result.rows[0]);
}

export async function getCoreTrick(worldId, client = null) {
  const db = run(client);
  const result = await db(`SELECT * FROM world_core_tricks WHERE world_id = $1`, [worldId]);
  return coreTrickRow(result.rows[0]);
}

export async function upsertCoreTrick(worldId, body, { patch = false, client = null } = {}) {
  const db = run(client);
  const payload = patch ? mergeCoreTrickPatch(await getCoreTrick(worldId, client), body) : normalizeCoreTrickBody(body);
  await validateCoreTrickRefs(worldId, payload, client);
  const result = await db(
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
      payload.summary || "",
      payload.killerRoleSlotId || null,
      payload.method || "",
      payload.motive || "",
      payload.victim || "",
      payload.hostNotes || "",
      JSON.stringify(payload.metadata || {})
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

export async function getRoleArchive(worldId, roleSlotId, client = null) {
  const db = run(client);
  const result = await db(
    `SELECT wra.*, rs.name AS role_name
     FROM world_role_archives wra
     JOIN role_slots rs ON rs.id = wra.role_slot_id
     WHERE wra.world_id = $1 AND wra.role_slot_id = $2`,
    [worldId, roleSlotId]
  );
  return roleArchiveRow(result.rows[0]);
}

export async function upsertRoleArchive(worldId, roleSlotId, body, { patch = false, client = null } = {}) {
  const db = run(client);
  await assertRoleSlotInWorld(worldId, roleSlotId, client);
  const payload = patch
    ? mergeRoleArchivePatch(await getRoleArchive(worldId, roleSlotId, client), body)
    : normalizeRoleArchiveBody(body);
  const result = await db(
    `INSERT INTO world_role_archives
      (world_id, role_slot_id, public_identity, hidden_identity, external_goal, internal_need,
       secret, action_line, inner_conflict, voice_hints, arc, lies, act_tasks, appearance_states, metadata, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, now())
     ON CONFLICT (role_slot_id) DO UPDATE SET
       world_id = EXCLUDED.world_id,
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
       appearance_states = EXCLUDED.appearance_states,
       metadata = EXCLUDED.metadata,
       updated_at = now()
     WHERE world_role_archives.world_id = EXCLUDED.world_id
     RETURNING *`,
    [
      worldId,
      roleSlotId,
      payload.publicIdentity || "",
      payload.hiddenIdentity || "",
      payload.externalGoal || "",
      payload.internalNeed || "",
      payload.secret || "",
      payload.actionLine || "",
      payload.innerConflict || "",
      payload.voiceHints || "",
      JSON.stringify(payload.arc || {}),
      JSON.stringify(payload.lies || []),
      JSON.stringify(payload.actTasks || []),
      JSON.stringify(payload.appearanceStates || []),
      JSON.stringify(payload.metadata || {})
    ]
  );
  if (!result.rowCount) throwErr("ROLE_SLOT_WORLD_MISMATCH");
  const row = result.rows[0];
  const nameResult = await db(`SELECT name FROM role_slots WHERE id = $1`, [roleSlotId]);
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

export async function createForeshadowBeat(worldId, body, client = null) {
  const db = run(client);
  const payload = normalizeForeshadowBody(body);
  await validateForeshadowRefs(worldId, payload, client);
  const result = await db(
    `INSERT INTO world_foreshadow_beats
      (world_id, title, plant_summary, surface_meaning, true_meaning, payoff_summary, sequence,
       plant_chapter_id, payoff_chapter_id, plant_section_id, payoff_section_id, clue_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
     RETURNING *`,
    [
      worldId,
      payload.title || "",
      payload.plantSummary || "",
      payload.surfaceMeaning || "",
      payload.trueMeaning || "",
      payload.payoffSummary || "",
      payload.sequence || 1,
      payload.plantChapterId || null,
      payload.payoffChapterId || null,
      payload.plantSectionId || null,
      payload.payoffSectionId || null,
      payload.clueId || null,
      JSON.stringify(payload.metadata || {})
    ]
  );
  return foreshadowRow(result.rows[0]);
}

export async function updateForeshadowBeat(worldId, beatId, patch, client = null) {
  const db = run(client);
  await validateForeshadowPatch(worldId, patch, client);
  const result = await db(
    `UPDATE world_foreshadow_beats SET
       title = COALESCE($3, title),
       plant_summary = COALESCE($4, plant_summary),
       surface_meaning = COALESCE($5, surface_meaning),
       true_meaning = COALESCE($6, true_meaning),
       payoff_summary = COALESCE($7, payoff_summary),
       sequence = COALESCE($8, sequence),
       plant_chapter_id = CASE WHEN $15 THEN $9 ELSE plant_chapter_id END,
       payoff_chapter_id = CASE WHEN $16 THEN $10 ELSE payoff_chapter_id END,
       plant_section_id = CASE WHEN $17 THEN $11 ELSE plant_section_id END,
       payoff_section_id = CASE WHEN $18 THEN $12 ELSE payoff_section_id END,
       clue_id = CASE WHEN $19 THEN $13 ELSE clue_id END,
       metadata = COALESCE($14::jsonb, metadata),
       updated_at = now()
     WHERE id = $1 AND world_id = $2
     RETURNING *`,
    [
      beatId,
      worldId,
      patch.title,
      patch.plantSummary,
      patch.surfaceMeaning,
      patch.trueMeaning,
      patch.payoffSummary,
      patch.sequence,
      patch.plantChapterId,
      patch.payoffChapterId,
      patch.plantSectionId,
      patch.payoffSectionId,
      patch.clueId,
      patch.metadata !== undefined ? JSON.stringify(patch.metadata) : null,
      Object.hasOwn(patch, "plantChapterId"),
      Object.hasOwn(patch, "payoffChapterId"),
      Object.hasOwn(patch, "plantSectionId"),
      Object.hasOwn(patch, "payoffSectionId"),
      Object.hasOwn(patch, "clueId")
    ]
  );
  return foreshadowRow(result.rows[0]);
}

export async function deleteForeshadowBeat(worldId, beatId, client = null) {
  const db = run(client);
  const result = await db(
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

export async function createTimelineEvent(worldId, body, client = null) {
  const db = run(client);
  const payload = normalizeTimelineEventBody(body);
  await validateTimelineRefs(worldId, payload, client);
  const result = await db(
    `INSERT INTO world_timeline_events
      (world_id, time_label, event_summary, sequence, chapter_id, scene_id, participant_role_ids, alibi_notes, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7::uuid[],$8,$9::jsonb)
     RETURNING *`,
    [
      worldId,
      payload.timeLabel || "",
      payload.eventSummary || "",
      payload.sequence || 1,
      payload.chapterId || null,
      payload.sceneId || null,
      payload.participantRoleIds || [],
      payload.alibiNotes || "",
      JSON.stringify(payload.metadata || {})
    ]
  );
  return timelineEventRow(result.rows[0]);
}

export async function updateTimelineEvent(worldId, eventId, patch, client = null) {
  const db = run(client);
  await validateTimelinePatch(worldId, patch, client);
  const result = await db(
    `UPDATE world_timeline_events SET
       time_label = COALESCE($3, time_label),
       event_summary = COALESCE($4, event_summary),
       sequence = COALESCE($5, sequence),
       chapter_id = CASE WHEN $11 THEN $6 ELSE chapter_id END,
       scene_id = CASE WHEN $12 THEN $7 ELSE scene_id END,
       participant_role_ids = COALESCE($8::uuid[], participant_role_ids),
       alibi_notes = COALESCE($9, alibi_notes),
       metadata = COALESCE($10::jsonb, metadata),
       updated_at = now()
     WHERE id = $1 AND world_id = $2
     RETURNING *`,
    [
      eventId,
      worldId,
      patch.timeLabel,
      patch.eventSummary,
      patch.sequence,
      patch.chapterId,
      patch.sceneId,
      patch.participantRoleIds,
      patch.alibiNotes,
      patch.metadata !== undefined ? JSON.stringify(patch.metadata) : null,
      Object.hasOwn(patch, "chapterId"),
      Object.hasOwn(patch, "sceneId")
    ]
  );
  return timelineEventRow(result.rows[0]);
}

export async function deleteTimelineEvent(worldId, eventId, client = null) {
  const db = run(client);
  const result = await db(
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

function materialBookletRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.world_id,
    kind: row.kind,
    title: row.title || "",
    summary: row.summary || "",
    ownerRoleSlotId: row.owner_role_slot_id || null,
    phaseLabel: row.phase_label || "",
    chapterId: row.chapter_id || null,
    visibility: row.visibility || "host_only",
    pages: Array.isArray(row.pages) ? row.pages : [],
    linkedClueIds: Array.isArray(row.linked_clue_ids) ? row.linked_clue_ids : [],
    linkedRoleSlotIds: Array.isArray(row.linked_role_slot_ids) ? row.linked_role_slot_ids : [],
    sequence: row.sequence || 1,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listMaterialBooklets(worldId) {
  const result = await query(
    `SELECT * FROM world_material_booklets WHERE world_id = $1 ORDER BY sequence, created_at`,
    [worldId]
  );
  return result.rows.map(materialBookletRow);
}

export async function createMaterialBooklet(worldId, body, client = null) {
  const db = run(client);
  const payload = normalizeMaterialBookletBody(body);
  await validateMaterialBookletRefs(worldId, payload, client);
  const result = await db(
    `INSERT INTO world_material_booklets
      (world_id, kind, title, summary, owner_role_slot_id, phase_label, chapter_id, visibility,
       pages, linked_clue_ids, linked_role_slot_ids, sequence, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::uuid[],$11::uuid[],$12,$13::jsonb)
     RETURNING *`,
    [
      worldId,
      payload.kind,
      payload.title || "",
      payload.summary || "",
      payload.ownerRoleSlotId || null,
      payload.phaseLabel || "",
      payload.chapterId || null,
      payload.visibility,
      JSON.stringify(payload.pages || []),
      payload.linkedClueIds || [],
      payload.linkedRoleSlotIds || [],
      payload.sequence || 1,
      JSON.stringify(payload.metadata || {})
    ]
  );
  return materialBookletRow(result.rows[0]);
}

export async function updateMaterialBooklet(worldId, bookletId, patch, client = null) {
  const db = run(client);
  await validateMaterialBookletPatch(worldId, patch, client);
  const result = await db(
    `UPDATE world_material_booklets SET
       kind = COALESCE($3, kind),
       title = COALESCE($4, title),
       summary = COALESCE($5, summary),
       owner_role_slot_id = CASE WHEN $14 THEN $6 ELSE owner_role_slot_id END,
       phase_label = COALESCE($7, phase_label),
       chapter_id = CASE WHEN $15 THEN $8 ELSE chapter_id END,
       visibility = COALESCE($9, visibility),
       pages = COALESCE($10::jsonb, pages),
       linked_clue_ids = CASE WHEN $16 THEN $11::uuid[] ELSE linked_clue_ids END,
       linked_role_slot_ids = CASE WHEN $17 THEN $12::uuid[] ELSE linked_role_slot_ids END,
       sequence = COALESCE($13, sequence),
       metadata = COALESCE($18::jsonb, metadata),
       updated_at = now()
     WHERE id = $1 AND world_id = $2
     RETURNING *`,
    [
      bookletId,
      worldId,
      patch.kind,
      patch.title,
      patch.summary,
      patch.ownerRoleSlotId,
      patch.phaseLabel,
      patch.chapterId,
      patch.visibility,
      patch.pages !== undefined ? JSON.stringify(patch.pages) : null,
      patch.linkedClueIds,
      patch.linkedRoleSlotIds,
      patch.sequence,
      Object.hasOwn(patch, "ownerRoleSlotId"),
      Object.hasOwn(patch, "chapterId"),
      Object.hasOwn(patch, "linkedClueIds"),
      Object.hasOwn(patch, "linkedRoleSlotIds"),
      patch.metadata !== undefined ? JSON.stringify(patch.metadata) : null
    ]
  );
  return materialBookletRow(result.rows[0]);
}

export async function deleteMaterialBooklet(worldId, bookletId, client = null) {
  const db = run(client);
  const result = await db(
    `DELETE FROM world_material_booklets WHERE id = $1 AND world_id = $2 RETURNING id`,
    [bookletId, worldId]
  );
  return result.rowCount > 0;
}
