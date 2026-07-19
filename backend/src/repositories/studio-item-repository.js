export async function configureStudioItemTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '15000ms', true)`
  );
}

export async function lockStudioItemEditor(client, { worldId, actorId }) {
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

export async function lockActiveWorldAsset(client, { worldId, assetId }) {
  if (!assetId) return null;
  const result = await client.query(
    `SELECT id FROM asset_files
     WHERE id = $1 AND world_id = $2
       AND status = 'active' AND deleted_at IS NULL
     FOR KEY SHARE`,
    [assetId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function createStudioItem(client, { worldId, name, publicText, hostText, metadata }) {
  const result = await client.query(
    `INSERT INTO items (world_id, name, public_text, host_text, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, name, public_text, host_text, metadata, created_at`,
    [worldId, name, publicText, hostText, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

export async function lockStudioItem(client, { worldId, itemId }) {
  const result = await client.query(
    `SELECT id, name, public_text, host_text, metadata, created_at
     FROM items
     WHERE id = $1 AND world_id = $2
     FOR UPDATE`,
    [itemId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function updateStudioItem(client, {
  worldId,
  itemId,
  name,
  publicText,
  hostText,
  metadata
}) {
  const result = await client.query(
    `UPDATE items
     SET name = $3, public_text = $4, host_text = $5, metadata = $6::jsonb
     WHERE id = $1 AND world_id = $2
     RETURNING id, name, public_text, host_text, metadata, created_at`,
    [itemId, worldId, name, publicText, hostText, JSON.stringify(metadata)]
  );
  return result.rows[0] ?? null;
}

export async function readStudioItemReferenceCounts(client, { worldId, itemId }) {
  const result = await client.query(
    `SELECT
       (SELECT COUNT(*)::int FROM investigation_points
        WHERE world_id = $1 AND required_item_id = $2) AS investigation_points,
       (SELECT COUNT(*)::int
        FROM inventory inventory_row
        JOIN rooms room ON room.id = inventory_row.room_id
        WHERE room.world_id = $1 AND inventory_row.item_id = $2) AS inventory,
       (SELECT COUNT(*)::int FROM automation_rules
        WHERE world_id = $1 AND (
          conditions @> jsonb_build_object('all', jsonb_build_array(jsonb_build_object('itemId', $2::text)))
          OR actions @> jsonb_build_array(jsonb_build_object('itemId', $2::text))
        )) AS automation_rules,
       (SELECT COUNT(*)::int FROM physical_tokens
        WHERE world_id = $1 AND content_type = 'item' AND content_id = $2) AS physical_tokens,
       (SELECT COUNT(*)::int
        FROM world_segment_refs segment_ref
        JOIN world_segments segment ON segment.id = segment_ref.segment_id
        WHERE segment.world_id = $1 AND segment_ref.ref_type = 'item' AND segment_ref.ref_id = $2) AS segments,
       (SELECT COUNT(*)::int
        FROM room_content_unlocks unlock
        JOIN rooms room ON room.id = unlock.room_id
        WHERE room.world_id = $1 AND unlock.content_type = 'item' AND unlock.content_id = $2) AS unlocks`,
    [worldId, itemId]
  );
  return result.rows[0];
}

export async function deleteStudioItem(client, { worldId, itemId }) {
  const result = await client.query(
    `DELETE FROM items WHERE id = $1 AND world_id = $2 RETURNING id`,
    [itemId, worldId]
  );
  return result.rowCount > 0;
}
