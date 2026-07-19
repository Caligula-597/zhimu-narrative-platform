export async function configureCreatorSectionTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '15000ms', true)`
  );
}

export async function lockCreatorSectionEditor(client, { worldId, actorId }) {
  const result = await client.query(
    `SELECT world_member.role
     FROM worlds world
     JOIN world_members world_member
       ON world_member.world_id = world.id AND world_member.user_id = $2
     WHERE world.id = $1
     FOR KEY SHARE OF world
     FOR SHARE OF world_member`,
    [worldId, actorId]
  );
  return result.rows[0]?.role ?? null;
}

export async function lockCreatorSectionRole(client, { worldId, roleSlotId }) {
  const result = await client.query(
    `SELECT id FROM role_slots
     WHERE id = $1 AND world_id = $2
     FOR UPDATE`,
    [roleSlotId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function lockCreatorSectionChapter(client, { worldId, chapterId }) {
  if (!chapterId) return null;
  const result = await client.query(
    `SELECT id FROM chapters
     WHERE id = $1 AND world_id = $2
     FOR KEY SHARE`,
    [chapterId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function ensureCharacterScript(client, roleSlotId) {
  const existing = await client.query(
    `SELECT id FROM character_scripts
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

export async function sectionSequenceExists(client, {
  characterScriptId,
  sequence,
  excludeSectionId
}) {
  const result = await client.query(
    `SELECT 1 FROM script_sections
     WHERE character_script_id = $1 AND sequence = $2
       AND ($3::uuid IS NULL OR id <> $3)
     LIMIT 1`,
    [characterScriptId, sequence, excludeSectionId ?? null]
  );
  return result.rowCount > 0;
}

export async function createCreatorSection(client, payload) {
  const result = await client.query(
    `INSERT INTO script_sections
       (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      payload.characterScriptId,
      payload.roleSlotId,
      payload.chapterId,
      payload.title,
      payload.body,
      payload.sequence,
      payload.publicationStatus
    ]
  );
  return result.rows[0];
}

export async function lockCreatorSection(client, { worldId, roleSlotId, sectionId }) {
  const result = await client.query(
    `SELECT section.*
     FROM script_sections section
     JOIN role_slots role_slot ON role_slot.id = section.role_slot_id
     WHERE section.id = $1
       AND section.role_slot_id = $2
       AND role_slot.world_id = $3
     FOR UPDATE OF section`,
    [sectionId, roleSlotId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function updateCreatorSection(client, payload) {
  const result = await client.query(
    `UPDATE script_sections
     SET title = $2, body = $3, chapter_id = $4,
         publication_status = $5, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [payload.sectionId, payload.title, payload.body, payload.chapterId, payload.publicationStatus]
  );
  return result.rows[0];
}

export async function deleteCreatorSection(client, sectionId) {
  const result = await client.query(
    `DELETE FROM script_sections WHERE id = $1 RETURNING id`,
    [sectionId]
  );
  return result.rowCount > 0;
}
