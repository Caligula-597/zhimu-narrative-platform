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
              'openStatus', 'locked',
              'pairKey', NULLIF(input.value->>'pairKey', '')
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
            jsonb_strip_nulls(jsonb_build_object(
              'source', 'structured_document_import',
              'importKey', input.value->>'importKey',
              'sourceFilename', input.value->>'filename',
              'pairKey', NULLIF(input.value->>'pairKey', ''),
              'sourceKind', NULLIF(input.value->>'sourceKind', ''),
              'cardKind', NULLIF(input.value->>'cardKind', ''),
              'catalogIndex', CASE
                WHEN input.value->>'catalogIndex' IS NULL OR input.value->>'catalogIndex' = '' THEN NULL
                ELSE to_jsonb((input.value->>'catalogIndex')::int)
              END,
              'triggerCondition', COALESCE(input.value->>'triggerCondition', ''),
              'grantMode', COALESCE(NULLIF(input.value->>'grantMode', ''), 'host_confirm'),
              'colocatedWithScene', COALESCE((input.value->>'colocatedWithScene')::boolean, false)
            ))
     from input
     WHERE NOT EXISTS (
       SELECT 1 FROM clues clue
       WHERE clue.world_id = $1
         AND clue.metadata->>'importKey' = input.value->>'importKey'
     )
     RETURNING id, name, metadata`,
    [worldId, JSON.stringify(clues)]
  );
  return result.rows;
}

export async function insertStructuredImportInvestigationLinks(client, { worldId, links }) {
  if (!links.length) return [];
  const result = await client.query(
    `WITH input AS MATERIALIZED (
       SELECT value FROM jsonb_array_elements($2::jsonb)
     )
     INSERT INTO investigation_points
       (world_id, scene_id, name, description, interaction_text, result_text, clue_id, sequence, metadata)
     SELECT $1,
            (input.value->>'sceneId')::uuid,
            input.value->>'name',
            COALESCE(input.value->>'description', ''),
            COALESCE(input.value->>'interactionText', ''),
            COALESCE(input.value->>'resultText', ''),
            NULLIF(input.value->>'clueId', '')::uuid,
            COALESCE((input.value->>'sequence')::int, 0),
            jsonb_build_object(
              'source', 'structured_document_import',
              'importKey', input.value->>'importKey',
              'pairKey', NULLIF(input.value->>'pairKey', ''),
              'triggerCondition', COALESCE(input.value->>'triggerCondition', '')
            )
     FROM input
     WHERE NOT EXISTS (
       SELECT 1 FROM investigation_points point
       WHERE point.world_id = $1
         AND point.metadata->>'importKey' = input.value->>'importKey'
     )
     RETURNING id, name`,
    [worldId, JSON.stringify(links)]
  );
  return result.rows;
}

export async function insertStructuredImportStoryEdges(client, { worldId, edges }) {
  if (!edges.length) return [];
  const inserted = [];
  for (const edge of edges) {
    const existing = await client.query(
      `SELECT id FROM story_graph_edges
       WHERE world_id = $1 AND from_type = $2 AND from_id = $3 AND to_type = $4 AND to_id = $5 AND relation_type = $6
       LIMIT 1`,
      [worldId, edge.fromType, edge.fromId, edge.toType, edge.toId, edge.relationType || "mainline"]
    );
    if (existing.rowCount) continue;
    const result = await client.query(
      `INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        worldId,
        edge.fromType,
        edge.fromId,
        edge.toType,
        edge.toId,
        edge.relationType || "mainline",
        edge.label || "场景线索"
      ]
    );
    inserted.push(result.rows[0]);
  }
  return inserted;
}

export async function insertStructuredImportRoleRelationships(client, { worldId, relationships }) {
  if (!relationships.length) return [];
  const inserted = [];
  for (const rel of relationships) {
    const existing = await client.query(
      `SELECT id FROM world_role_relationships
       WHERE world_id = $1 AND from_role_slot_id = $2 AND to_role_slot_id = $3 AND label = $4
       LIMIT 1`,
      [worldId, rel.fromRoleSlotId, rel.toRoleSlotId, rel.label || ""]
    );
    if (existing.rowCount) continue;
    const result = await client.query(
      `INSERT INTO world_role_relationships
         (world_id, from_role_slot_id, to_role_slot_id, relation_type, label, strength, visibility, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       RETURNING id`,
      [
        worldId,
        rel.fromRoleSlotId,
        rel.toRoleSlotId,
        rel.relationType || "other",
        rel.label || "关系",
        Number.isFinite(Number(rel.strength)) ? Number(rel.strength) : 0,
        rel.visibility || "host",
        JSON.stringify({ source: "structured_document_import", ...(rel.metadata || {}) })
      ]
    );
    inserted.push(result.rows[0]);
  }
  return inserted;
}

export async function upsertStructuredImportCoreTrick(client, { worldId, coreTrick, killerRoleSlotId = null }) {
  const result = await client.query(
    `INSERT INTO world_core_tricks
      (world_id, summary, killer_role_slot_id, method, motive, victim, host_notes, metadata, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb, now())
     ON CONFLICT (world_id) DO UPDATE SET
       summary = CASE
         WHEN coalesce(world_core_tricks.summary, '') = '' THEN EXCLUDED.summary
         ELSE world_core_tricks.summary
       END,
       killer_role_slot_id = COALESCE(world_core_tricks.killer_role_slot_id, EXCLUDED.killer_role_slot_id),
       host_notes = CASE
         WHEN coalesce(world_core_tricks.host_notes, '') = '' THEN EXCLUDED.host_notes
         ELSE world_core_tricks.host_notes
       END,
       metadata = COALESCE(world_core_tricks.metadata, '{}'::jsonb) || EXCLUDED.metadata,
       updated_at = now()
     RETURNING world_id`,
    [
      worldId,
      coreTrick.summary || "",
      killerRoleSlotId,
      coreTrick.method || "",
      coreTrick.motive || "",
      coreTrick.victim || "",
      coreTrick.hostNotes || "",
      JSON.stringify(coreTrick.metadata || { source: "structured_document_import" })
    ]
  );
  return result.rows[0] || null;
}

export async function mergeStructuredImportWorldHandbook(client, { worldId, hostHandbook, miniGameTemplates }) {
  await client.query(
    `UPDATE worlds
     SET settings = COALESCE(settings, '{}'::jsonb)
       || jsonb_build_object(
            'hostHandbook', COALESCE(settings->'hostHandbook', '{}'::jsonb) || $2::jsonb,
            'miniGameTemplates', CASE
              WHEN jsonb_typeof(settings->'miniGameTemplates') = 'array'
                   AND jsonb_array_length(settings->'miniGameTemplates') > 0
              THEN settings->'miniGameTemplates'
              ELSE $3::jsonb
            END
          ),
         updated_at = now()
     WHERE id = $1`,
    [worldId, JSON.stringify(hostHandbook || {}), JSON.stringify(miniGameTemplates || [])]
  );
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
