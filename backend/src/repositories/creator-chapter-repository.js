const CHAPTER_FIELDS = `
  id, world_id, title, summary, sequence, publication_status,
  unlock_rules, metadata, created_at, updated_at`;

export async function insertCreatorChapter(client, { worldId, title, summary, sequence }) {
  const result = await client.query(
    `INSERT INTO chapters (world_id, title, summary, sequence)
     VALUES ($1, $2, $3, $4)
     RETURNING ${CHAPTER_FIELDS}`,
    [worldId, title, summary, sequence]
  );
  return result.rows[0];
}

export async function lockCreatorChapter(client, { worldId, chapterId }) {
  const result = await client.query(
    `SELECT ${CHAPTER_FIELDS}
     FROM chapters
     WHERE id = $1 AND world_id = $2
     FOR UPDATE`,
    [chapterId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function updateCreatorChapter(client, {
  chapterId,
  title,
  summary,
  publicationStatus,
  unlockRules,
  metadata
}) {
  const result = await client.query(
    `UPDATE chapters
     SET title = $2,
         summary = $3,
         publication_status = $4,
         unlock_rules = $5::jsonb,
         metadata = $6::jsonb,
         updated_at = now()
     WHERE id = $1
     RETURNING ${CHAPTER_FIELDS}`,
    [
      chapterId,
      title,
      summary,
      publicationStatus,
      JSON.stringify(unlockRules),
      JSON.stringify(metadata)
    ]
  );
  return result.rows[0];
}
