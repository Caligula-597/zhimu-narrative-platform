import { query, transaction } from "../db.js";

export async function listAssets(listSql, params) {
  return (await query(listSql, params)).rows;
}

export async function countAssets(countSql, params) {
  return Number((await query(countSql, params)).rows[0]?.total || 0);
}

export async function roomBelongsToWorld(roomId, worldId) {
  const result = await query(`SELECT 1 FROM rooms WHERE id = $1 AND world_id = $2`, [roomId, worldId]);
  return result.rowCount > 0;
}

export async function roleBelongsToWorld(roleSlotId, worldId) {
  const result = await query(`SELECT 1 FROM role_slots WHERE id = $1 AND world_id = $2`, [roleSlotId, worldId]);
  return result.rowCount > 0;
}

export function createPendingAssetUpload({
  actorId,
  worldId,
  roomId,
  assetKind,
  visibility,
  roleSlotId,
  objectKey,
  filename,
  contentType,
  byteSize,
  expiresAt
}) {
  return transaction(async (client) => {
    const file = await client.query(
      `INSERT INTO asset_files
        (owner_user_id, world_id, room_id, asset_kind, visibility, role_slot_id, object_key, original_filename, content_type, byte_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [actorId, worldId, roomId, assetKind, visibility, roleSlotId, objectKey, filename, contentType, byteSize]
    );
    const session = await client.query(
      `INSERT INTO upload_sessions
        (asset_file_id, owner_user_id, object_key, expected_content_type, expected_byte_size, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [file.rows[0].id, actorId, objectKey, contentType, byteSize, expiresAt]
    );
    return { asset: file.rows[0], uploadSessionId: session.rows[0].id };
  });
}

export function cancelPendingAssetUpload(assetId, uploadSessionId) {
  return transaction(async (client) => {
    await client.query(
      `DELETE FROM upload_sessions WHERE id = $1 AND asset_file_id = $2 AND status = 'created'`,
      [uploadSessionId, assetId]
    );
    await client.query(
      `DELETE FROM asset_files WHERE id = $1 AND status = 'pending_upload'`,
      [assetId]
    );
  });
}

export async function findPendingUploadSession(assetId, actorId) {
  const result = await query(
    `SELECT us.*, a.object_key, a.original_filename, a.world_id FROM upload_sessions us
     JOIN asset_files a ON a.id = us.asset_file_id
     WHERE us.asset_file_id = $1 AND us.owner_user_id = $2
       AND us.status = 'created' AND us.expires_at > now()`,
    [assetId, actorId]
  );
  return result.rows[0] || null;
}

export async function quarantineUpload(assetId, uploadSessionId, scanCode) {
  await transaction(async (client) => {
    await client.query(
      `UPDATE asset_files
       SET status = 'quarantined', updated_at = now(), metadata = metadata || $2::jsonb
       WHERE id = $1`,
      [assetId, JSON.stringify({ scanError: scanCode, quarantinedAt: new Date().toISOString() })]
    );
    await client.query(`UPDATE upload_sessions SET status = 'cancelled' WHERE id = $1`, [uploadSessionId]);
  });
}

export async function confirmUploadedAsset(client, { assetId, uploadSessionId, objectKey, byteSize }) {
  const claimed = await client.query(
    `UPDATE upload_sessions
     SET status = 'confirmed', confirmed_at = now()
     WHERE id = $1 AND asset_file_id = $2 AND status = 'created'
     RETURNING id`,
    [uploadSessionId, assetId]
  );
  if (!claimed.rowCount) return null;
  await client.query(`UPDATE asset_files SET status = 'active', updated_at = now() WHERE id = $1`, [assetId]);
  await client.query(
    `INSERT INTO asset_versions (asset_file_id, version_number, object_key, byte_size)
     VALUES ($1, 1, $2, $3)`,
    [assetId, objectKey, byteSize]
  );
  return { ok: true, assetId };
}

export async function findOwnedActiveAsset(assetId, actorId) {
  const result = await query(
    `SELECT id, world_id FROM asset_files
     WHERE id = $1 AND owner_user_id = $2 AND status <> 'deleted'`,
    [assetId, actorId]
  );
  return result.rows[0] || null;
}

export async function markAssetDeleted(client, { assetId, actorId, recycleDays }) {
  await client.query(
    `UPDATE asset_files SET status = 'deleted', deleted_at = now(), updated_at = now() WHERE id = $1`,
    [assetId]
  );
  await client.query(
    `INSERT INTO deleted_assets (asset_file_id, deleted_by_user_id, purge_after)
     VALUES ($1, $2, now() + ($3 || ' days')::interval)
     ON CONFLICT (asset_file_id) DO UPDATE SET purge_after = EXCLUDED.purge_after`,
    [assetId, actorId, recycleDays]
  );
  return { ok: true, purgeAfterDays: recycleDays };
}

export async function findRestorableAsset(assetId, actorId) {
  const result = await query(
    `SELECT af.id, af.world_id FROM asset_files af
     JOIN deleted_assets da ON da.asset_file_id = af.id
     WHERE af.id = $1 AND af.owner_user_id = $2
       AND af.status = 'deleted' AND da.purge_after > now()`,
    [assetId, actorId]
  );
  return result.rows[0] || null;
}

export async function restoreDeletedAsset(client, assetId) {
  await client.query(
    `UPDATE asset_files SET status = 'active', deleted_at = NULL, updated_at = now() WHERE id = $1`,
    [assetId]
  );
  await client.query(`DELETE FROM deleted_assets WHERE asset_file_id = $1`, [assetId]);
  return { ok: true, assetId };
}
