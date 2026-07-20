export async function lockStructuredImportWorld(client, worldId) {
  const result = await client.query(`SELECT id FROM worlds WHERE id = $1 FOR UPDATE`, [worldId]);
  return result.rowCount > 0;
}

async function namedEntityMap(client, table, column, worldId) {
  const result = await client.query(
    `SELECT (array_agg(id ORDER BY created_at, id))[1] AS id,
            lower(btrim(${column})) AS lookup_key
     FROM ${table}
     WHERE world_id = $1
     GROUP BY lower(btrim(${column}))
     HAVING COUNT(*) = 1`,
    [worldId]
  );
  return new Map(result.rows.map((row) => [row.lookup_key, row.id]));
}

export function loadStructuredImportRoleMap(client, worldId) {
  return namedEntityMap(client, "role_slots", "name", worldId);
}

export function loadStructuredImportChapterMap(client, worldId) {
  return namedEntityMap(client, "chapters", "title", worldId);
}

export async function insertStructuredImportRoles(client, { worldId, roles }) {
  if (!roles.length) return [];
  const result = await client.query(
    `WITH input AS MATERIALIZED (
       SELECT value, ordinality
       FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY
     ), missing AS MATERIALIZED (
       SELECT input.value, input.ordinality
       FROM input
       WHERE NOT EXISTS (
         SELECT 1 FROM role_slots role
         WHERE role.world_id = $1
           AND lower(btrim(role.name)) = lower(btrim(input.value->>'name'))
       )
     ), sequence_base AS MATERIALIZED (
       SELECT COALESCE(MAX(sequence), 0)::int AS value
       FROM role_slots
       WHERE world_id = $1
     )
     INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence, settings)
     SELECT $1,
            missing.value->>'name',
            '',
            '',
            sequence_base.value + row_number() OVER (ORDER BY missing.ordinality)::int,
            jsonb_build_object(
              'source', 'structured_document_import',
              'importKey', missing.value->>'importKey'
            )
     FROM missing CROSS JOIN sequence_base
     RETURNING id, name`,
    [worldId, JSON.stringify(roles)]
  );
  return result.rows;
}

export async function insertStructuredImportChapters(client, { worldId, chapters }) {
  if (!chapters.length) return [];
  const result = await client.query(
    `WITH input AS MATERIALIZED (
       SELECT value, ordinality
       FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY
     ), missing AS MATERIALIZED (
       SELECT input.value, input.ordinality
       FROM input
       WHERE NOT EXISTS (
         SELECT 1 FROM chapters chapter
         WHERE chapter.world_id = $1
           AND lower(btrim(chapter.title)) = lower(btrim(input.value->>'title'))
       )
     ), sequence_base AS MATERIALIZED (
       SELECT COALESCE(MAX(sequence), 0)::int AS value
       FROM chapters
       WHERE world_id = $1
     )
     INSERT INTO chapters (world_id, title, summary, sequence, publication_status, metadata)
     SELECT $1,
            missing.value->>'title',
            COALESCE(missing.value->>'body', ''),
            sequence_base.value + row_number() OVER (ORDER BY missing.ordinality)::int,
            'draft',
            jsonb_build_object(
              'source', 'structured_document_import',
              'importKey', missing.value->>'importKey'
            )
     FROM missing CROSS JOIN sequence_base
     RETURNING id, title`,
    [worldId, JSON.stringify(chapters)]
  );
  return result.rows;
}

export async function insertStructuredImportRoleSections(client, { worldId, sections }) {
  if (!sections.length) return [];
  const roleIds = [...new Set(sections.map((section) => section.roleSlotId))];
  await client.query(
    `SELECT id FROM role_slots WHERE world_id = $1 AND id = ANY($2::uuid[]) FOR UPDATE`,
    [worldId, roleIds]
  );
  await client.query(
    `INSERT INTO character_scripts (role_slot_id, title)
     SELECT role.id, '角色私人剧本'
     FROM role_slots role
     WHERE role.world_id = $1
       AND role.id = ANY($2::uuid[])
       AND NOT EXISTS (
         SELECT 1 FROM character_scripts script WHERE script.role_slot_id = role.id
       )`,
    [worldId, roleIds]
  );
  const result = await client.query(
    `WITH input AS MATERIALIZED (
       SELECT value, ordinality
       FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY
     ), resolved AS MATERIALIZED (
       SELECT input.value,
              input.ordinality,
              script.id AS script_id,
              role.id AS role_slot_id,
              chapter.id AS chapter_id
       FROM input
       JOIN role_slots role
         ON role.id = (input.value->>'roleSlotId')::uuid
        AND role.world_id = $1
       JOIN LATERAL (
         SELECT id FROM character_scripts
         WHERE role_slot_id = role.id
         ORDER BY created_at
         LIMIT 1
       ) script ON true
       LEFT JOIN chapters chapter
         ON chapter.id = NULLIF(input.value->>'chapterId', '')::uuid
        AND chapter.world_id = $1
       WHERE COALESCE(btrim(input.value->>'body'), '') <> ''
         AND NOT EXISTS (
           SELECT 1 FROM script_sections section
           WHERE section.role_slot_id = role.id
             AND section.metadata->>'importKey' = input.value->>'importKey'
         )
     ), numbered AS MATERIALIZED (
       SELECT resolved.*,
              row_number() OVER (PARTITION BY script_id ORDER BY ordinality)::int AS offset
       FROM resolved
     ), bases AS MATERIALIZED (
       SELECT numbered.script_id, COALESCE(MAX(section.sequence), 0)::int AS value
       FROM numbered
       LEFT JOIN script_sections section ON section.character_script_id = numbered.script_id
       GROUP BY numbered.script_id
     )
     INSERT INTO script_sections
       (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status, metadata)
     SELECT numbered.script_id,
            numbered.role_slot_id,
            numbered.chapter_id,
            numbered.value->>'title',
            numbered.value->>'body',
            bases.value + numbered.offset,
            'draft',
            jsonb_build_object(
              'source', 'structured_document_import',
              'filename', numbered.value->>'filename',
              'importKey', numbered.value->>'importKey'
            )
     FROM numbered
     JOIN bases ON bases.script_id = numbered.script_id
     RETURNING id, role_slot_id, title`,
    [worldId, JSON.stringify(sections)]
  );
  return result.rows;
}

export async function insertStructuredImportScenes(client, { worldId, scenes }) {
  if (!scenes.length) return [];
  const result = await client.query(
    `WITH input AS MATERIALIZED (
       SELECT value FROM jsonb_array_elements($2::jsonb)
     )
     INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text, metadata)
     SELECT $1,
            NULLIF(input.value->>'chapterId', '')::uuid,
            input.value->>'title',
            '',
            COALESCE(input.value->>'body', ''),
            jsonb_build_object(
              'source', 'structured_document_import',
              'importKey', input.value->>'importKey',
              'openStatus', 'locked'
            )
     FROM input
     WHERE NOT EXISTS (
       SELECT 1 FROM scenes scene
       WHERE scene.world_id = $1
         AND scene.metadata->>'importKey' = input.value->>'importKey'
     )
     RETURNING id, name`,
    [worldId, JSON.stringify(scenes)]
  );
  return result.rows;
}

export async function insertStructuredImportClues(client, { worldId, clues }) {
  if (!clues.length) return [];
  const result = await client.query(
    `WITH input AS MATERIALIZED (
       SELECT value FROM jsonb_array_elements($2::jsonb)
     )
     INSERT INTO clues (world_id, name, public_text, host_text, visibility, clue_kind, metadata)
     SELECT $1,
            input.value->>'title',
            '',
            COALESCE(input.value->>'body', ''),
            'host',
            'general',
            jsonb_build_object(
              'source', 'structured_document_import',
              'importKey', input.value->>'importKey',
              'sourceFilename', input.value->>'filename'
            )
     FROM input
     WHERE NOT EXISTS (
       SELECT 1 FROM clues clue
       WHERE clue.world_id = $1
         AND clue.metadata->>'importKey' = input.value->>'importKey'
     )
     RETURNING id, name`,
    [worldId, JSON.stringify(clues)]
  );
  return result.rows;
}

export async function insertStructuredImportSecrets(client, { worldId, secrets }) {
  if (!secrets.length) return [];
  const result = await client.query(
    `WITH input AS MATERIALIZED (
       SELECT value FROM jsonb_array_elements($2::jsonb)
     )
     INSERT INTO world_truth_claims
       (world_id, claim_key, title, claim, reveal_stage, confidence, metadata)
     SELECT $1,
            input.value->>'claimKey',
            input.value->>'title',
            COALESCE(NULLIF(input.value->>'body', ''), input.value->>'title'),
            input.value->>'parentActTitle',
            'canon',
            jsonb_build_object(
              'source', 'structured_document_import',
              'importKey', input.value->>'importKey',
              'sourceFilename', input.value->>'filename',
              'roleName', input.value->>'roleName'
            )
     FROM input
     ON CONFLICT (world_id, claim_key) DO NOTHING
     RETURNING id, title`,
    [worldId, JSON.stringify(secrets)]
  );
  return result.rows;
}
