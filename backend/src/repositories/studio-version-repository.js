export async function configureStudioVersionTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '30000ms', true)`
  );
}

export async function lockStudioVersionEditor(client, { worldId, actorId }) {
  const result = await client.query(
    `SELECT world_member.role
     FROM worlds world
     JOIN world_members world_member
       ON world_member.world_id = world.id AND world_member.user_id = $2
     WHERE world.id = $1
     FOR UPDATE OF world
     FOR SHARE OF world_member`,
    [worldId, actorId]
  );
  return result.rows[0]?.role ?? null;
}

export async function countContentVersions(client, worldId) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count FROM content_versions WHERE world_id = $1`,
    [worldId]
  );
  return result.rows[0].count;
}

export async function createContentVersion(client, { worldId, actorId, label, snapshot }) {
  const result = await client.query(
    `INSERT INTO content_versions (world_id, created_by_user_id, label, snapshot)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, label, created_at`,
    [worldId, actorId, label, JSON.stringify(snapshot)]
  );
  return result.rows[0];
}

export async function lockContentVersion(client, { worldId, versionId }) {
  const result = await client.query(
    `SELECT snapshot
     FROM content_versions
     WHERE id = $1 AND world_id = $2
     FOR SHARE`,
    [versionId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function snapshotHasForeignReferences(client, { worldId, snapshot }) {
  const result = await client.query(
    `WITH snapshot_chapters AS (
       SELECT id
       FROM jsonb_to_recordset($2::jsonb) AS chapter(id uuid)
     ), snapshot_sections AS (
       SELECT id, chapter_id
       FROM jsonb_to_recordset($3::jsonb) AS section(id uuid, chapter_id uuid)
     )
     SELECT EXISTS (
       SELECT 1
       FROM snapshot_chapters snapshot
       JOIN chapters current_row ON current_row.id = snapshot.id
       WHERE current_row.world_id <> $1
       UNION ALL
       SELECT 1
       FROM snapshot_sections snapshot
       JOIN script_sections current_row ON current_row.id = snapshot.id
       JOIN role_slots role_slot ON role_slot.id = current_row.role_slot_id
       WHERE role_slot.world_id <> $1
       UNION ALL
       SELECT 1
       FROM snapshot_sections snapshot
       JOIN chapters current_row ON current_row.id = snapshot.chapter_id
       WHERE current_row.world_id <> $1
     ) AS invalid`,
    [worldId, JSON.stringify(snapshot.chapters), JSON.stringify(snapshot.sections)]
  );
  return result.rows[0].invalid;
}

export async function restoreVersionChapters(client, { worldId, chapters }) {
  const result = await client.query(
    `WITH snapshot AS (
       SELECT *
       FROM jsonb_to_recordset($2::jsonb) AS chapter(
         id uuid,
         title text,
         summary text,
         publication_status text,
         unlock_rules jsonb
       )
     )
     UPDATE chapters chapter
     SET title = snapshot.title,
         summary = COALESCE(snapshot.summary, ''),
         publication_status = COALESCE(snapshot.publication_status, chapter.publication_status),
         unlock_rules = COALESCE(snapshot.unlock_rules, '{}'::jsonb),
         updated_at = now()
     FROM snapshot
     WHERE chapter.id = snapshot.id AND chapter.world_id = $1
     RETURNING chapter.id`,
    [worldId, JSON.stringify(chapters)]
  );
  return result.rowCount;
}

export async function restoreVersionSections(client, { worldId, sections }) {
  const result = await client.query(
    `WITH snapshot AS (
       SELECT *
       FROM jsonb_to_recordset($2::jsonb) AS section(
         id uuid,
         title text,
         body text,
         chapter_id uuid,
         publication_status text
       )
     )
     UPDATE script_sections section
     SET title = snapshot.title,
         body = snapshot.body,
         chapter_id = snapshot.chapter_id,
         publication_status = COALESCE(snapshot.publication_status, section.publication_status),
         updated_at = now()
     FROM snapshot, role_slots role_slot
     WHERE section.id = snapshot.id
       AND role_slot.id = section.role_slot_id
       AND role_slot.world_id = $1
       AND (
         snapshot.chapter_id IS NULL
         OR EXISTS (
           SELECT 1 FROM chapters chapter
           WHERE chapter.id = snapshot.chapter_id AND chapter.world_id = $1
         )
       )
     RETURNING section.id`,
    [worldId, JSON.stringify(sections)]
  );
  return result.rowCount;
}

export async function deleteContentVersion(client, { worldId, versionId }) {
  const result = await client.query(
    `DELETE FROM content_versions
     WHERE id = $1 AND world_id = $2
     RETURNING id`,
    [versionId, worldId]
  );
  return result.rowCount > 0;
}
