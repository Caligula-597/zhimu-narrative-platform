export async function validateSegmentReferences(client, { worldId, chapterId, refs }) {
  const normalizedRefs = (refs ?? []).map((ref) => ({
    ref_type: ref.refType,
    ref_id: ref.refId,
    role_slot_id: ref.roleSlotId ?? null
  }));
  const result = await client.query(
    `WITH requested AS (
       SELECT ref_type, ref_id, role_slot_id
       FROM jsonb_to_recordset($3::jsonb)
         AS ref(ref_type text, ref_id uuid, role_slot_id uuid)
     ), checked AS (
       SELECT requested.*,
         CASE requested.ref_type
           WHEN 'chapter' THEN EXISTS (
             SELECT 1 FROM chapters entity
             WHERE entity.id = requested.ref_id AND entity.world_id = $1
           )
           WHEN 'script_section' THEN EXISTS (
             SELECT 1
             FROM script_sections entity
             JOIN role_slots owner_role ON owner_role.id = entity.role_slot_id
             WHERE entity.id = requested.ref_id AND owner_role.world_id = $1
           )
           WHEN 'scene' THEN EXISTS (
             SELECT 1 FROM scenes entity
             WHERE entity.id = requested.ref_id AND entity.world_id = $1
           )
           WHEN 'clue' THEN EXISTS (
             SELECT 1 FROM clues entity
             WHERE entity.id = requested.ref_id AND entity.world_id = $1
           )
           WHEN 'item' THEN EXISTS (
             SELECT 1 FROM items entity
             WHERE entity.id = requested.ref_id AND entity.world_id = $1
           )
           WHEN 'rule' THEN EXISTS (
             SELECT 1 FROM automation_rules entity
             WHERE entity.id = requested.ref_id AND entity.world_id = $1
           )
           WHEN 'truth_claim' THEN EXISTS (
             SELECT 1 FROM world_truth_claims entity
             WHERE entity.id = requested.ref_id AND entity.world_id = $1
           )
           ELSE false
         END AS reference_valid,
         requested.role_slot_id IS NULL OR EXISTS (
           SELECT 1 FROM role_slots role_slot
           WHERE role_slot.id = requested.role_slot_id AND role_slot.world_id = $1
         ) AS role_valid,
         requested.ref_type <> 'script_section'
           OR requested.role_slot_id IS NULL
           OR EXISTS (
             SELECT 1 FROM script_sections section
             WHERE section.id = requested.ref_id
               AND section.role_slot_id = requested.role_slot_id
           ) AS section_role_valid
       FROM requested
     )
     SELECT
       $2::uuid IS NULL OR EXISTS (
         SELECT 1 FROM chapters chapter
         WHERE chapter.id = $2 AND chapter.world_id = $1
       ) AS chapter_valid,
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'refType', checked.ref_type,
           'refId', checked.ref_id,
           'roleSlotId', checked.role_slot_id
         ))
         FROM checked
         WHERE NOT checked.reference_valid
            OR NOT checked.role_valid
            OR NOT checked.section_role_valid
       ), '[]'::jsonb) AS invalid_refs`,
    [worldId, chapterId ?? null, JSON.stringify(normalizedRefs)]
  );
  return result.rows[0];
}

export async function segmentKeyExists(client, { worldId, segmentKey, excludeSegmentId }) {
  const result = await client.query(
    `SELECT 1
     FROM world_segments
     WHERE world_id = $1 AND segment_key = $2
       AND ($3::uuid IS NULL OR id <> $3)
     LIMIT 1`,
    [worldId, segmentKey, excludeSegmentId ?? null]
  );
  return result.rowCount > 0;
}

export async function createWorldSegment(client, { worldId, body, operations }) {
  const result = await client.query(
    `INSERT INTO world_segments
       (world_id, segment_key, title, sequence, chapter_id, story, mechanics,
        operations, quality, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)
     RETURNING *`,
    [
      worldId,
      body.segmentKey,
      body.title,
      body.sequence ?? 1,
      body.chapterId ?? null,
      JSON.stringify(body.story ?? {}),
      JSON.stringify(body.mechanics ?? {}),
      JSON.stringify(operations),
      JSON.stringify(body.quality ?? {}),
      JSON.stringify(body.metadata ?? {})
    ]
  );
  return result.rows[0];
}

export async function lockWorldSegment(client, { worldId, segmentId }) {
  const result = await client.query(
    `SELECT *
     FROM world_segments
     WHERE id = $1 AND world_id = $2
     FOR UPDATE`,
    [segmentId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function updateWorldSegment(client, {
  worldId,
  segmentId,
  values,
  operations
}) {
  const result = await client.query(
    `UPDATE world_segments
     SET segment_key = $3,
         title = $4,
         sequence = $5,
         chapter_id = $6,
         story = $7::jsonb,
         mechanics = $8::jsonb,
         operations = $9::jsonb,
         quality = $10::jsonb,
         metadata = $11::jsonb,
         updated_at = now()
     WHERE id = $1 AND world_id = $2
     RETURNING *`,
    [
      segmentId,
      worldId,
      values.segmentKey,
      values.title,
      values.sequence,
      values.chapterId,
      JSON.stringify(values.story),
      JSON.stringify(values.mechanics),
      JSON.stringify(operations),
      JSON.stringify(values.quality),
      JSON.stringify(values.metadata)
    ]
  );
  return result.rows[0];
}

export async function replaceSegmentRefs(client, segmentId, refs = []) {
  await client.query(`DELETE FROM world_segment_refs WHERE segment_id = $1`, [segmentId]);
  if (!refs.length) return;
  const normalizedRefs = refs.map((ref) => ({
    ref_type: ref.refType,
    ref_id: ref.refId,
    role_slot_id: ref.roleSlotId ?? null,
    metadata: ref.metadata ?? {}
  }));
  await client.query(
    `INSERT INTO world_segment_refs
       (segment_id, ref_type, ref_id, role_slot_id, metadata)
     SELECT $1, ref.ref_type, ref.ref_id, ref.role_slot_id, ref.metadata
     FROM jsonb_to_recordset($2::jsonb)
       AS ref(ref_type text, ref_id uuid, role_slot_id uuid, metadata jsonb)`,
    [segmentId, JSON.stringify(normalizedRefs)]
  );
}

export async function listSegmentRefs(client, segmentId) {
  const result = await client.query(
    `SELECT ref_type, ref_id, role_slot_id, metadata
     FROM world_segment_refs
     WHERE segment_id = $1
     ORDER BY created_at`,
    [segmentId]
  );
  return result.rows.map((row) => ({
    refType: row.ref_type,
    refId: row.ref_id,
    roleSlotId: row.role_slot_id,
    metadata: row.metadata ?? {}
  }));
}
