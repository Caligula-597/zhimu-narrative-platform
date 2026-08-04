/**
 * Public world cover images for lobby / catalog listings.
 * Uses worlds.settings.coverAssetId when set, else first active image asset.
 */
import { query } from "./db.js";
import { getObjectStorage } from "./storage/index.js";
import { resolveSignedDownloadTtlSeconds } from "./asset-lifetime-policy.js";
import { throwErr } from "./api-errors.js";

export function worldCoverApiPath(worldId) {
  return `/api/platform/worlds/${worldId}/cover`;
}

export async function isWorldPubliclyVisible(worldId) {
  const result = await query(
    `SELECT 1
     FROM worlds w
     WHERE w.id = $1
       AND w.status <> 'archived'
       AND (
         w.catalog_public = true
         OR EXISTS (
           SELECT 1 FROM rooms r
           WHERE r.world_id = w.id
             AND r.public_listing = true
             AND r.status <> 'completed'
         )
       )
     LIMIT 1`,
    [worldId]
  );
  return result.rowCount > 0;
}

export async function resolveWorldCoverAsset(worldId) {
  const result = await query(
    `SELECT af.id, af.object_key, af.content_type
     FROM worlds w
     JOIN asset_files af ON af.world_id = w.id
     WHERE w.id = $1
       AND af.status = 'active'
       AND af.asset_kind = 'image'
       AND af.deleted_at IS NULL
     ORDER BY
       CASE
         WHEN NULLIF(w.settings->>'coverAssetId', '')::uuid = af.id THEN 0
         ELSE 1
       END,
       af.created_at ASC
     LIMIT 1`,
    [worldId]
  );
  return result.rows[0] || null;
}

export async function resolveWorldCoverUrl(worldId) {
  const asset = await resolveWorldCoverAsset(worldId);
  return asset ? worldCoverApiPath(worldId) : null;
}

export async function serveWorldCoverRedirect(worldId) {
  if (!await isWorldPubliclyVisible(worldId)) throwErr("NOT_FOUND");
  const asset = await resolveWorldCoverAsset(worldId);
  if (!asset) throwErr("NOT_FOUND");
  const ttl = resolveSignedDownloadTtlSeconds();
  const downloadUrl = await getObjectStorage().createDownloadUrl({
    key: asset.object_key,
    expiresIn: ttl
  });
  return { downloadUrl, contentType: asset.content_type };
}
