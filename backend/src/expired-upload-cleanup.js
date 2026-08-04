import { query } from "./db.js";
import { getObjectStorage } from "./storage/index.js";

export const DEFAULT_EXPIRED_UPLOAD_BATCH_SIZE = 500;
export const DEFAULT_UPLOAD_CLEANUP_GRACE_SECONDS = 15 * 60;

function boundedInteger(raw, fallback, min, max) {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

export function resolveExpiredUploadCleanupOptions(env = process.env) {
  return {
    batchSize: boundedInteger(
      env.UPLOAD_CLEANUP_BATCH_SIZE,
      DEFAULT_EXPIRED_UPLOAD_BATCH_SIZE,
      1,
      5_000
    ),
    graceSeconds: boundedInteger(
      env.UPLOAD_CLEANUP_GRACE_SECONDS,
      DEFAULT_UPLOAD_CLEANUP_GRACE_SECONDS,
      60,
      60 * 60
    )
  };
}

/**
 * Delete storage first and the pending database row second. A storage failure
 * leaves the row/session available for a later retry; deleting the asset row
 * cascades its upload session. The grace window prevents a confirmation that
 * began immediately before expiry from racing this job.
 */
export async function cleanupExpiredUploads({
  db = query,
  storage = getObjectStorage(),
  batchSize,
  graceSeconds
} = {}) {
  const defaults = resolveExpiredUploadCleanupOptions();
  const limit = boundedInteger(batchSize, defaults.batchSize, 1, 5_000);
  const grace = boundedInteger(graceSeconds, defaults.graceSeconds, 60, 60 * 60);
  const result = await db(
    `SELECT us.id AS upload_session_id, a.id AS asset_id, a.object_key
     FROM upload_sessions us
     JOIN asset_files a ON a.id = us.asset_file_id
     WHERE us.status IN ('created', 'expired')
       AND a.status = 'pending_upload'
       AND us.expires_at <= now() - ($1::text || ' seconds')::interval
     ORDER BY us.expires_at, us.id
     LIMIT $2`,
    [grace, limit]
  );
  const summary = { selected: result.rows.length, deleted: 0, failed: 0, failures: [] };
  for (const upload of result.rows) {
    try {
      await storage.deleteObject({ key: upload.object_key });
      const deleted = await db(
        `DELETE FROM asset_files
         WHERE id = $1 AND status = 'pending_upload' AND object_key = $2`,
        [upload.asset_id, upload.object_key]
      );
      if (deleted.rowCount) summary.deleted += 1;
    } catch (error) {
      summary.failed += 1;
      summary.failures.push({
        uploadSessionId: upload.upload_session_id,
        assetId: upload.asset_id,
        message: error?.message ?? String(error)
      });
    }
  }
  return summary;
}
