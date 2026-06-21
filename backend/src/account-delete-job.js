import { query } from "./db.js";
import { getObjectStorage } from "./storage/index.js";

export async function collectUserObjectKeys(userId, client = null) {
  const run = client ? client.query.bind(client) : query;
  const keys = await run(
    `SELECT af.object_key AS key FROM asset_files af WHERE af.owner_user_id = $1 AND af.object_key IS NOT NULL
     UNION
     SELECT av.object_key AS key FROM asset_versions av
     INNER JOIN asset_files af ON af.id = av.asset_file_id
     WHERE af.owner_user_id = $1 AND av.object_key IS NOT NULL`,
    [userId]
  );
  return keys.rows.map((row) => row.key).filter(Boolean);
}

export async function createAccountDeleteJob(userId, objectKeys, client = null) {
  const run = client ? client.query.bind(client) : query;
  const inserted = await run(
    `INSERT INTO account_delete_jobs (user_id, status, object_keys)
     VALUES ($1, 'pending', $2::jsonb)
     RETURNING id`,
    [userId, JSON.stringify(objectKeys)]
  );
  return inserted.rows[0].id;
}

export async function markAccountDeleteJobDbDeleted(jobId, client = null) {
  const run = client ? client.query.bind(client) : query;
  await run(
    `UPDATE account_delete_jobs
     SET status = 'db_deleted', updated_at = now(), attempt_count = attempt_count + 1
     WHERE id = $1`,
    [jobId]
  );
}

export async function markAccountDeleteJobCompleted(jobId, purgedCount, client = null) {
  const run = client ? client.query.bind(client) : query;
  await run(
    `UPDATE account_delete_jobs
     SET status = 'completed',
         storage_purged_count = $2,
         updated_at = now(),
         completed_at = now(),
         last_error = NULL
     WHERE id = $1`,
    [jobId, purgedCount]
  );
}

export async function markAccountDeleteJobStoragePending(jobId, { purgedCount, error }, client = null) {
  const run = client ? client.query.bind(client) : query;
  await run(
    `UPDATE account_delete_jobs
     SET status = 'storage_pending',
         storage_purged_count = $2,
         last_error = $3,
         updated_at = now(),
         attempt_count = attempt_count + 1
     WHERE id = $1`,
    [jobId, purgedCount, String(error?.message || error || "storage purge failed").slice(0, 2000)]
  );
}

export async function markAccountDeleteJobFailed(jobId, error, client = null) {
  const run = client ? client.query.bind(client) : query;
  await run(
    `UPDATE account_delete_jobs
     SET status = 'failed',
         last_error = $2,
         updated_at = now(),
         attempt_count = attempt_count + 1
     WHERE id = $1`,
    [jobId, String(error?.message || error || "delete failed").slice(0, 2000)]
  );
}

export async function purgeObjectKeys(objectKeys) {
  if (!objectKeys.length) return { purgedCount: 0, failed: [] };

  let storage = null;
  try {
    storage = getObjectStorage();
  } catch {
    return { purgedCount: 0, failed: objectKeys.slice() };
  }

  let purgedCount = 0;
  const failed = [];
  for (const key of objectKeys) {
    try {
      await storage.deleteObject({ key });
      purgedCount += 1;
    } catch {
      failed.push(key);
    }
  }
  return { purgedCount, failed };
}

/** Retry storage purge for jobs where DB delete already succeeded. */
export async function processPendingAccountDeleteJobs({ limit = 20 } = {}) {
  const pending = await query(
    `SELECT id, object_keys
     FROM account_delete_jobs
     WHERE status IN ('db_deleted', 'storage_pending')
     ORDER BY updated_at ASC
     LIMIT $1`,
    [limit]
  );

  const results = [];
  for (const row of pending.rows) {
    const keys = Array.isArray(row.object_keys) ? row.object_keys : [];
    const { purgedCount, failed } = await purgeObjectKeys(keys);
    if (failed.length === 0) {
      await markAccountDeleteJobCompleted(row.id, purgedCount);
      results.push({ jobId: row.id, status: "completed", purgedCount });
    } else {
      await markAccountDeleteJobStoragePending(row.id, {
        purgedCount,
        error: `${failed.length} object(s) still pending`
      });
      results.push({ jobId: row.id, status: "storage_pending", purgedCount, pendingObjects: failed.length });
    }
  }
  return results;
}
