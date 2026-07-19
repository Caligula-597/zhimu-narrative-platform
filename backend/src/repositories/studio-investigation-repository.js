export async function configureStudioInvestigationTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '15000ms', true)`
  );
}

export async function lockStudioInvestigationEditor(client, { worldId, actorId }) {
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

export async function lockInvestigationReferences(client, {
  worldId,
  sceneId,
  clueId,
  requiredItemId,
  requiredRoleSlotId
}) {
  const result = await client.query(
    `SELECT
       (SELECT scene.id
        FROM scenes scene
        WHERE scene.id = $2 AND scene.world_id = $1
        FOR KEY SHARE) AS scene_id,
       (SELECT clue.id
        FROM clues clue
        WHERE clue.id = $3 AND clue.world_id = $1
        FOR KEY SHARE) AS clue_id,
       (SELECT item.id
        FROM items item
        WHERE item.id = $4 AND item.world_id = $1
        FOR KEY SHARE) AS required_item_id,
       (SELECT role_slot.id
        FROM role_slots role_slot
        WHERE role_slot.id = $5 AND role_slot.world_id = $1
        FOR KEY SHARE) AS required_role_slot_id`,
    [worldId, sceneId ?? null, clueId ?? null, requiredItemId ?? null, requiredRoleSlotId ?? null]
  );
  return result.rows[0];
}

export async function updateInvestigationPoint(client, {
  worldId,
  pointId,
  name,
  description,
  interactionText,
  resultText,
  sceneId,
  clueId,
  requiredItemId,
  requiredRoleSlotId,
  sequence,
  metadata
}) {
  const result = await client.query(
    `UPDATE investigation_points
     SET name = COALESCE($3, name),
         description = COALESCE($4, description),
         interaction_text = COALESCE($5, interaction_text),
         result_text = COALESCE($6, result_text),
         scene_id = COALESCE($7::uuid, scene_id),
         clue_id = CASE WHEN $8::text IS NULL THEN clue_id ELSE NULLIF($8::text, '')::uuid END,
         required_item_id = CASE WHEN $9::text IS NULL THEN required_item_id ELSE NULLIF($9::text, '')::uuid END,
         required_role_slot_id = CASE WHEN $10::text IS NULL THEN required_role_slot_id ELSE NULLIF($10::text, '')::uuid END,
         sequence = COALESCE($11, sequence),
         metadata = COALESCE(metadata, '{}'::jsonb) || $12::jsonb
     WHERE id = $1 AND world_id = $2
     RETURNING id, scene_id, name, description, interaction_text, result_text, clue_id,
               required_item_id, required_role_slot_id, sequence, metadata`,
    [
      pointId,
      worldId,
      name ?? null,
      description ?? null,
      interactionText ?? null,
      resultText ?? null,
      sceneId ?? null,
      clueId === undefined ? null : (clueId ?? ""),
      requiredItemId === undefined ? null : (requiredItemId ?? ""),
      requiredRoleSlotId === undefined ? null : (requiredRoleSlotId ?? ""),
      sequence ?? null,
      JSON.stringify(metadata ?? {})
    ]
  );
  return result.rows[0] ?? null;
}

export async function createInvestigationPoint(client, {
  worldId,
  sceneId,
  name,
  description,
  interactionText,
  resultText,
  clueId,
  requiredItemId,
  requiredRoleSlotId,
  sequence,
  metadata
}) {
  const result = await client.query(
    `INSERT INTO investigation_points
       (world_id, scene_id, name, description, interaction_text, result_text, clue_id,
        required_item_id, required_role_slot_id, sequence, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
     RETURNING *`,
    [
      worldId,
      sceneId,
      name,
      description,
      interactionText,
      resultText,
      clueId,
      requiredItemId,
      requiredRoleSlotId,
      sequence,
      JSON.stringify(metadata ?? {})
    ]
  );
  return result.rows[0];
}
