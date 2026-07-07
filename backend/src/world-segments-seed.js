import { normalizeSegmentOperations, resolveChapterSegmentKey } from "./segment-contract.js";

/**
 * World segment seeding — compile Matrix pipeline / chapter graph into world_segments.
 */
function sanitizeText(value = "", max = 8000) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

async function replaceSegmentRefs(client, segmentId, refs = []) {
  await client.query(`DELETE FROM world_segment_refs WHERE segment_id = $1`, [segmentId]);
  for (const ref of refs) {
    if (!ref?.refType || !ref?.refId) continue;
    await client.query(
      `INSERT INTO world_segment_refs (segment_id, ref_type, ref_id, role_slot_id, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        segmentId,
        ref.refType,
        ref.refId,
        ref.roleSlotId ?? null,
        JSON.stringify(ref.metadata ?? {})
      ]
    );
  }
}

async function upsertWorldSegment(client, worldId, payload) {
  const {
    segmentKey,
    title,
    sequence,
    chapterId = null,
    story = {},
    operations = {},
    mechanics = {},
    metadata = {},
    refs = []
  } = payload;
  const existing = await client.query(
    `SELECT id FROM world_segments WHERE world_id = $1 AND segment_key = $2 LIMIT 1`,
    [worldId, segmentKey]
  );
  if (existing.rowCount) {
    const segmentId = existing.rows[0].id;
    await client.query(
      `UPDATE world_segments SET
         title = $1, sequence = $2, chapter_id = $3,
         story = $4::jsonb, operations = $5::jsonb, mechanics = $6::jsonb,
         metadata = COALESCE(metadata, '{}'::jsonb) || $7::jsonb, updated_at = now()
       WHERE id = $8`,
      [
        title,
        sequence,
        chapterId,
        JSON.stringify(story),
        JSON.stringify(operations),
        JSON.stringify(mechanics),
        JSON.stringify(metadata),
        segmentId
      ]
    );
    await replaceSegmentRefs(client, segmentId, refs);
    return { id: segmentId, created: false };
  }
  const created = await client.query(
    `INSERT INTO world_segments
      (world_id, segment_key, title, sequence, chapter_id, story, mechanics, operations, quality, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, '{}'::jsonb, $9::jsonb)
     RETURNING id`,
    [
      worldId,
      segmentKey,
      title,
      sequence,
      chapterId,
      JSON.stringify(story),
      JSON.stringify(mechanics),
      JSON.stringify(operations),
      JSON.stringify(metadata)
    ]
  );
  const segmentId = created.rows[0].id;
  await replaceSegmentRefs(client, segmentId, refs);
  return { id: segmentId, created: true };
}

async function buildSegmentRefs(client, worldId, actKey, { chapterId, runbook, clueIds }) {
  const refs = [];
  const seen = new Set();
  const pushRef = (ref) => {
    const key = `${ref.refType}:${ref.refId}:${ref.roleSlotId || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  };

  if (chapterId) pushRef({ refType: "chapter", refId: chapterId });

  const sections = await client.query(
    `SELECT ss.id, ss.role_slot_id
     FROM script_sections ss
     JOIN role_slots rs ON rs.id = ss.role_slot_id
     WHERE rs.world_id = $1
       AND (
         ss.metadata->>'segmentKey' = $2
         OR ss.metadata->>'proposalKey' = $2
         OR ss.metadata->>'matrixActKey' = $2
         OR ss.metadata->>'actKey' = $2
         OR ss.metadata->>'chapterKey' = $2
         OR ss.chapter_id = $3
       )`,
    [worldId, actKey, chapterId]
  );
  for (const row of sections.rows) {
    pushRef({ refType: "script_section", refId: row.id, roleSlotId: row.role_slot_id });
  }

  const scenes = await client.query(
    `SELECT id FROM scenes WHERE world_id = $1 AND metadata->>'chapterKey' = $2`,
    [worldId, actKey]
  );
  for (const row of scenes.rows) {
    pushRef({ refType: "scene", refId: row.id });
  }

  if (chapterId) {
    const chapterScenes = await client.query(`SELECT id FROM scenes WHERE world_id = $1 AND chapter_id = $2`, [
      worldId,
      chapterId
    ]);
    for (const row of chapterScenes.rows) {
      pushRef({ refType: "scene", refId: row.id });
    }
  }

  for (const grant of runbook?.clueGrants || []) {
    const clueId = clueIds?.get?.(grant.clueId) || clueIds?.[grant.clueId];
    if (clueId) {
      pushRef({
        refType: "clue",
        refId: clueId,
        metadata: { when: sanitizeText(grant.when, 200) || undefined }
      });
    }
  }

  return refs;
}

function playerTasksForAct(characterArchives, ...actKeys) {
  const keys = new Set(actKeys.filter(Boolean));
  const tasks = [];
  const seen = new Set();
  for (const role of characterArchives?.roles || []) {
    for (const actTask of role.actTasks || []) {
      const key = actTask.actKey || actTask.act_key;
      if (!keys.has(key)) continue;
      for (const item of actTask.tasks || []) {
        const body = sanitizeText(item, 800);
        if (!body || seen.has(body)) continue;
        seen.add(body);
        tasks.push(body);
      }
    }
  }
  return tasks;
}

/**
 * Compile Matrix pipeline acts into world_segments (idempotent upsert by segment_key).
 */
export async function seedWorldSegmentsFromPipeline(client, worldId, pipeline, graph) {
  const chapters = pipeline?.proposal?.chapters || [];
  if (!chapters.length) return 0;

  const hostRunbooks = Array.isArray(pipeline.hostRunbooks) ? pipeline.hostRunbooks : [];
  const characterArchives = pipeline.characterArchives || {};
  const infoMatrix = pipeline.infoMatrix || {};
  const runbookByAct = new Map(hostRunbooks.map((row) => [row.actKey, row]));
  const chapterIds = graph?.chapterIds || new Map();
  const clueIds = graph?.clueIds || new Map();

  let count = 0;
  for (const [index, chapter] of chapters.entries()) {
    const actKey = resolveChapterSegmentKey(chapter, index + 1);
    const sourceKey = chapter.key || actKey;
    const chapterId = chapterIds.get(actKey) || chapterIds.get(sourceKey) || null;
    const runbook = runbookByAct.get(actKey) || runbookByAct.get(sourceKey);
    const story = {
      summary: sanitizeText(chapter.summary || infoMatrix.actSummaries?.[actKey] || infoMatrix.actSummaries?.[sourceKey] || "", 4000),
      publicEnvironment: infoMatrix.publicEnvironmentByAct?.[actKey] || infoMatrix.publicEnvironmentByAct?.[sourceKey] || null,
      actTitle: sanitizeText(infoMatrix.actTitles?.[actKey] || infoMatrix.actTitles?.[sourceKey] || chapter.title || actKey, 200)
    };
    const playerTasks = playerTasksForAct(characterArchives, actKey, sourceKey);
    const operations = normalizeSegmentOperations({
      title: runbook?.title,
      flow: runbook?.flow,
      hostTruth: runbook?.hostTruth,
      clueGrants: runbook?.clueGrants || [],
      fallbacks: runbook?.fallbacks || [],
      playerTasks
    });
    const refs = await buildSegmentRefs(client, worldId, actKey, { chapterId, runbook, clueIds });

    await upsertWorldSegment(client, worldId, {
      segmentKey: actKey,
      title: sanitizeText(runbook?.title || chapter.title || actKey, 200),
      sequence: chapter.sequence ?? index + 1,
      chapterId,
      story,
      operations,
      mechanics: { source: "matrix_import", actKey },
      metadata: { source: "matrix_import", actKey },
      refs
    });
    count += 1;
  }
  return count;
}

/**
 * Rebuild segments from existing chapters + script_sections (no Matrix host runbook required).
 */
export async function syncWorldSegmentsFromChapters(client, worldId) {
  const chapters = await client.query(
    `SELECT id, title, sequence, metadata
     FROM chapters WHERE world_id = $1 ORDER BY sequence, created_at`,
    [worldId]
  );
  if (!chapters.rowCount) return 0;

  let count = 0;
  for (const chapter of chapters.rows) {
    const actKey = resolveChapterSegmentKey(chapter, count + 1);
    const refs = await buildSegmentRefs(client, worldId, actKey, {
      chapterId: chapter.id,
      runbook: null,
      clueIds: new Map()
    });
    await upsertWorldSegment(client, worldId, {
      segmentKey: actKey,
      title: sanitizeText(chapter.title || actKey, 200),
      sequence: chapter.sequence || count + 1,
      chapterId: chapter.id,
      story: { summary: sanitizeText(chapter.metadata?.summary || "", 2000) },
      operations: {},
      mechanics: { source: "chapter_sync" },
      metadata: { source: "chapter_sync", actKey },
      refs
    });
    count += 1;
  }
  return count;
}
