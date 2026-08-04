import { randomUUID } from "node:crypto";
import { query, transaction } from "./db.js";
import { getObjectStorage } from "./storage/index.js";

const DEFAULT_CLAIM_TTL_MINUTES = 15;

export function resolveAccountDeleteClaimTtlMinutes(
  raw = process.env.ACCOUNT_DELETE_JOB_CLAIM_TTL_MINUTES
) {
  const value = Number(raw ?? DEFAULT_CLAIM_TTL_MINUTES);
  return Number.isInteger(value) && value >= 5 && value <= 120
    ? value
    : DEFAULT_CLAIM_TTL_MINUTES;
}

export async function collectUserObjectKeys(userId, client = null) {
  const run = client ? client.query.bind(client) : query;
  const keys = await run(
    `SELECT af.object_key AS key FROM asset_files af WHERE af.owner_user_id = $1 AND af.object_key IS NOT NULL
     UNION
     SELECT av.object_key AS key FROM asset_versions av
     INNER JOIN asset_files af ON af.id = av.asset_file_id
     WHERE af.owner_user_id = $1 AND av.object_key IS NOT NULL
     UNION
     SELECT profile.avatar_object_key AS key
     FROM user_portal_profiles profile
     WHERE profile.user_id = $1 AND profile.avatar_object_key IS NOT NULL
     UNION
     SELECT upload.object_key AS key
     FROM portal_profile_avatar_uploads upload
     WHERE upload.user_id = $1 AND upload.object_key IS NOT NULL`,
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

export async function markAccountDeleteJobDbDeleted(
  jobId,
  client = null,
  { claimToken = null } = {}
) {
  const run = client ? client.query.bind(client) : query;
  await run(
    `UPDATE account_delete_jobs
     SET status = CASE WHEN $2::uuid IS NULL THEN 'db_deleted' ELSE 'storage_processing' END,
         claim_token = $2::uuid,
         claimed_at = CASE WHEN $2::uuid IS NULL THEN NULL ELSE now() END,
         updated_at = now(),
         attempt_count = attempt_count + 1
     WHERE id = $1`,
    [jobId, claimToken]
  );
}

export async function markAccountDeleteJobCompleted(
  jobId,
  purgedCount,
  client = null,
  claimToken = null
) {
  const run = client ? client.query.bind(client) : query;
  const updated = await run(
    `UPDATE account_delete_jobs
     SET status = 'completed',
         storage_purged_count = $2,
         updated_at = now(),
         completed_at = now(),
         last_error = NULL,
         claim_token = NULL,
         claimed_at = NULL
     WHERE id = $1
       AND (
         $3::uuid IS NULL
         OR (status = 'storage_processing' AND claim_token = $3::uuid)
       )`,
    [jobId, purgedCount, claimToken]
  );
  return updated.rowCount > 0;
}

export async function markAccountDeleteJobStoragePending(
  jobId,
  { purgedCount, error },
  client = null,
  claimToken = null
) {
  const run = client ? client.query.bind(client) : query;
  const updated = await run(
    `UPDATE account_delete_jobs
     SET status = 'storage_pending',
         storage_purged_count = $2,
         last_error = $3,
         updated_at = now(),
         attempt_count = attempt_count + 1,
         claim_token = NULL,
         claimed_at = NULL
     WHERE id = $1
       AND (
         $4::uuid IS NULL
         OR (status = 'storage_processing' AND claim_token = $4::uuid)
       )`,
    [
      jobId,
      purgedCount,
      String(error?.message || error || "storage purge failed").slice(0, 2000),
      claimToken
    ]
  );
  return updated.rowCount > 0;
}

export async function markAccountDeleteJobFailed(jobId, error, client = null) {
  const run = client ? client.query.bind(client) : query;
  await run(
    `UPDATE account_delete_jobs
     SET status = 'failed',
         last_error = $2,
         updated_at = now(),
         attempt_count = attempt_count + 1,
         claim_token = NULL,
         claimed_at = NULL
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

export async function claimPendingAccountDeleteJobs({
  limit = 20,
  claimToken = randomUUID(),
  claimTtlMinutes = resolveAccountDeleteClaimTtlMinutes()
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeClaimTtl = resolveAccountDeleteClaimTtlMinutes(claimTtlMinutes);
  const jobs = await transaction(async (client) => {
    const claimed = await client.query(
      `WITH candidates AS (
         SELECT id
         FROM account_delete_jobs
         WHERE status IN ('db_deleted', 'storage_pending')
            OR (
              status = 'storage_processing'
              AND claimed_at < now() - make_interval(mins => $3::int)
            )
         ORDER BY updated_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE account_delete_jobs job
       SET status = 'storage_processing',
           claim_token = $2::uuid,
           claimed_at = now(),
           updated_at = now()
       FROM candidates
       WHERE job.id = candidates.id
       RETURNING job.id, job.object_keys`,
      [safeLimit, claimToken, safeClaimTtl]
    );
    return claimed.rows;
  });
  return { claimToken, jobs };
}

/** Retry storage purge for jobs where DB delete already succeeded. */
export async function processPendingAccountDeleteJobs({
  limit = 20,
  purge = purgeObjectKeys,
  claimToken = randomUUID()
} = {}) {
  const claimed = await claimPendingAccountDeleteJobs({ limit, claimToken });
  const results = [];
  for (const row of claimed.jobs) {
    const keys = Array.isArray(row.object_keys) ? row.object_keys : [];
    let purgeResult;
    try {
      purgeResult = await purge(keys);
    } catch (error) {
      purgeResult = { purgedCount: 0, failed: keys.length ? keys : ["storage purge failed"], error };
    }
    const purgedCount = Number(purgeResult?.purgedCount) || 0;
    const failed = Array.isArray(purgeResult?.failed) ? purgeResult.failed : keys;
    if (failed.length === 0) {
      const updated = await markAccountDeleteJobCompleted(row.id, purgedCount, null, claimed.claimToken);
      results.push({
        jobId: row.id,
        status: updated ? "completed" : "superseded",
        purgedCount
      });
    } else {
      const updated = await markAccountDeleteJobStoragePending(
        row.id,
        {
          purgedCount,
          error: purgeResult?.error || `${failed.length} object(s) still pending`
        },
        null,
        claimed.claimToken
      );
      results.push({
        jobId: row.id,
        status: updated ? "storage_pending" : "superseded",
        purgedCount,
        pendingObjects: failed.length
      });
    }
  }
  return results;
}
