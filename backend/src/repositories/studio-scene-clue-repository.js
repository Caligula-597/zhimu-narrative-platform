export async function configureStudioSceneClueTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '15000ms', true)`
  );
}

export async function lockStudioSceneClueEditor(client, { worldId, actorId }) {
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

export async function lockSceneChapterReference(client, { worldId, chapterId }) {
  if (!chapterId) return null;
  const result = await client.query(
    `SELECT id
     FROM chapters
     WHERE id = $1 AND world_id = $2
     FOR KEY SHARE`,
    [chapterId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function createStudioScene(client, {
  worldId,
  chapterId,
  name,
  publicText,
  hostText,
  metadata
}) {
  const result = await client.query(
    `INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING *`,
    [worldId, chapterId, name, publicText, hostText, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

export async function createStudioClue(client, {
  worldId,
  name,
  publicText,
  hostText,
  visibility,
  clueKind,
  metadata
}) {
  const result = await client.query(
    `INSERT INTO clues (world_id, name, public_text, host_text, visibility, clue_kind, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING *`,
    [worldId, name, publicText, hostText, visibility, clueKind, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

export async function updateStudioScene(client, {
  worldId,
  sceneId,
  name,
  publicText,
  hostText,
  chapterId,
  metadata
}) {
  const result = await client.query(
    `UPDATE scenes
     SET name = COALESCE($3, name),
         public_text = COALESCE($4, public_text),
         host_text = COALESCE($5, host_text),
         chapter_id = CASE WHEN $6::text IS NULL THEN chapter_id ELSE NULLIF($6::text, '')::uuid END,
         metadata = COALESCE(metadata, '{}'::jsonb) || $7::jsonb
     WHERE id = $1 AND world_id = $2
     RETURNING id, chapter_id, name, public_text, host_text, metadata`,
    [
      sceneId,
      worldId,
      name ?? null,
      publicText ?? null,
      hostText ?? null,
      chapterId === undefined ? null : (chapterId ?? ""),
      JSON.stringify(metadata ?? {})
    ]
  );
  return result.rows[0] ?? null;
}

export async function updateStudioClue(client, {
  worldId,
  clueId,
  name,
  publicText,
  hostText,
  visibility,
  clueKind,
  metadata
}) {
  const result = await client.query(
    `UPDATE clues
     SET name = COALESCE($3, name),
         public_text = COALESCE($4, public_text),
         host_text = COALESCE($5, host_text),
         visibility = COALESCE($6, visibility),
         clue_kind = COALESCE($7, clue_kind),
         metadata = COALESCE(metadata, '{}'::jsonb) || $8::jsonb
     WHERE id = $1 AND world_id = $2
     RETURNING id, name, public_text, host_text, visibility, clue_kind, metadata`,
    [
      clueId,
      worldId,
      name ?? null,
      publicText ?? null,
      hostText ?? null,
      visibility ?? null,
      clueKind ?? null,
      JSON.stringify(metadata ?? {})
    ]
  );
  return result.rows[0] ?? null;
}
