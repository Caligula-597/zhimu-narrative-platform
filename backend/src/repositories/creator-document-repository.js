import { throwErr } from "../api-errors.js";

export async function configureCreatorDocumentTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '30000ms', true)`
  );
}

export async function lockDocumentEditor(client, { worldId, actorId }) {
  const result = await client.query(
    `SELECT role
     FROM world_members
     WHERE world_id = $1 AND user_id = $2
     FOR SHARE`,
    [worldId, actorId]
  );
  const role = result.rows[0]?.role;
  if (!role) throwErr("WORLD_ACCESS_DENIED");
  if (!["owner", "editor"].includes(role)) throwErr("WORLD_EDITOR_REQUIRED");
  return role;
}

export async function lockDocumentRole(client, { worldId, roleSlotId }) {
  const result = await client.query(
    `SELECT id, name
     FROM role_slots
     WHERE id = $1 AND world_id = $2
     FOR UPDATE`,
    [roleSlotId, worldId]
  );
  if (!result.rowCount) throwErr("ROLE_SLOT_IMPORT_REQUIRED");
  return result.rows[0];
}

export async function upsertStoryManuscript(client, { worldId, actorId, body }) {
  await client.query(
    `INSERT INTO story_manuscripts (world_id, body, last_sync_direction, updated_by_user_id)
     VALUES ($1, $2, 'manual', $3)
     ON CONFLICT (world_id) DO UPDATE
     SET body = EXCLUDED.body,
         last_sync_direction = 'manual',
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_at = now()`,
    [worldId, body, actorId]
  );
}

/** Immutable import snapshot in settings.importSource; manuscript row only if not manually edited. */
export async function upsertImportSourceSnapshot(client, {
  worldId,
  actorId,
  body,
  filename = "",
  sourceKey = "",
  sha256 = ""
}) {
  const text = String(body ?? "");
  const snapshot = {
    body: text,
    filename: String(filename ?? "").trim(),
    sourceKey: String(sourceKey ?? "").trim(),
    sha256: String(sha256 ?? "").trim(),
    importedAt: new Date().toISOString(),
    characterCount: text.length
  };
  await client.query(
    `UPDATE worlds
     SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('importSource', $2::jsonb),
         updated_at = now()
     WHERE id = $1`,
    [worldId, JSON.stringify(snapshot)]
  );
  await client.query(
    `INSERT INTO story_manuscripts (world_id, body, last_sync_direction, updated_by_user_id)
     VALUES ($1, $2, 'import_source', $3)
     ON CONFLICT (world_id) DO UPDATE
     SET body = CASE
           WHEN story_manuscripts.last_sync_direction IN ('manual', 'manuscript_to_graph')
             THEN story_manuscripts.body
           ELSE EXCLUDED.body
         END,
         last_sync_direction = CASE
           WHEN story_manuscripts.last_sync_direction IN ('manual', 'manuscript_to_graph')
             THEN story_manuscripts.last_sync_direction
           ELSE 'import_source'
         END,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_at = now()`,
    [worldId, text, actorId]
  );
  return snapshot;
}

export async function ensureDocumentCharacterScript(client, roleSlotId) {
  const existing = await client.query(
    `SELECT id
     FROM character_scripts
     WHERE role_slot_id = $1
     ORDER BY created_at
     LIMIT 1`,
    [roleSlotId]
  );
  if (existing.rowCount) return existing.rows[0].id;
  const inserted = await client.query(
    `INSERT INTO character_scripts (role_slot_id, title)
     VALUES ($1, '角色私人剧本')
     RETURNING id`,
    [roleSlotId]
  );
  return inserted.rows[0].id;
}

export async function findImportedDocumentSection(client, {
  roleSlotId,
  importKeys,
  includePageChildren = false
}) {
  const result = await client.query(
    `SELECT id
     FROM script_sections
     WHERE role_slot_id = $1
       AND metadata ? 'importKey'
       AND (
         metadata->>'importKey' = ANY($2::text[])
         OR ($3::boolean AND EXISTS (
           SELECT 1
           FROM unnest($2::text[]) AS candidate(import_key)
           WHERE position(candidate.import_key || ':page:' IN metadata->>'importKey') = 1
         ))
       )
     ORDER BY created_at
     LIMIT 1`,
    [roleSlotId, importKeys, includePageChildren]
  );
  return result.rows[0] ?? null;
}

export async function insertDocumentSections(client, {
  scriptId,
  roleSlotId,
  publicationStatus = "draft",
  sections
}) {
  const result = await client.query(
    `WITH sequence_base AS MATERIALIZED (
       SELECT COALESCE(MAX(sequence), 0)::int AS value
       FROM script_sections
       WHERE character_script_id = $1
     ), input AS MATERIALIZED (
       SELECT value, ordinality
       FROM jsonb_array_elements($3::jsonb) WITH ORDINALITY
     )
     INSERT INTO script_sections
       (character_script_id, role_slot_id, title, body, sequence, publication_status, metadata)
     SELECT $1,
            $2,
            input.value->>'title',
            input.value->>'body',
            sequence_base.value + input.ordinality::int,
            $4,
            COALESCE(input.value->'metadata', '{}'::jsonb)
     FROM input
     CROSS JOIN sequence_base
     RETURNING id, title, sequence, metadata`,
    [scriptId, roleSlotId, JSON.stringify(sections), publicationStatus]
  );
  return result.rows.sort((left, right) => left.sequence - right.sequence);
}
