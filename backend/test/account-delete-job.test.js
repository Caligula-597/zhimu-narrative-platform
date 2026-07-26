import assert from "node:assert/strict";
import test from "node:test";
import { query } from "../src/db.js";
import {
  collectUserObjectKeys,
  createAccountDeleteJob,
  markAccountDeleteJobCompleted,
  markAccountDeleteJobDbDeleted,
  processPendingAccountDeleteJobs,
  resolveAccountDeleteClaimTtlMinutes
} from "../src/account-delete-job.js";

test("account delete job tracks db-first then storage completion", async () => {
  const user = await query(
    `INSERT INTO users (email, display_name, password_hash, user_kind)
     VALUES ($1, $2, 'hash', 'registered')
     RETURNING id`,
    [`job-test-${Date.now()}@zhimu.local`, "JobTest"]
  );
  const userId = user.rows[0].id;

  const keys = await collectUserObjectKeys(userId);
  assert.deepEqual(keys, []);

  const jobId = await createAccountDeleteJob(userId, keys);
  await markAccountDeleteJobDbDeleted(jobId);
  await markAccountDeleteJobCompleted(jobId, 0);

  const row = await query(`SELECT status FROM account_delete_jobs WHERE id = $1`, [jobId]);
  assert.equal(row.rows[0].status, "completed");

  await query(`DELETE FROM account_delete_jobs WHERE id = $1`, [jobId]);
  await query(`DELETE FROM users WHERE id = $1`, [userId]);
});

test("processPendingAccountDeleteJobs completes db_deleted jobs with no objects", async () => {
  const user = await query(
    `INSERT INTO users (email, display_name, password_hash, user_kind)
     VALUES ($1, $2, 'hash', 'registered')
     RETURNING id`,
    [`job-retry-${Date.now()}@zhimu.local`, "JobRetry"]
  );
  const userId = user.rows[0].id;
  const jobId = await createAccountDeleteJob(userId, []);
  await markAccountDeleteJobDbDeleted(jobId);

  const results = await processPendingAccountDeleteJobs({ limit: 5 });
  assert.ok(results.some((item) => item.jobId === jobId && item.status === "completed"));

  await query(`DELETE FROM account_delete_jobs WHERE id = $1`, [jobId]);
  await query(`DELETE FROM users WHERE id = $1`, [userId]);
});

test("account delete storage I/O runs after a short SKIP LOCKED claim", async () => {
  assert.equal(resolveAccountDeleteClaimTtlMinutes("1"), 15);
  assert.equal(resolveAccountDeleteClaimTtlMinutes("20"), 20);

  const user = await query(
    `INSERT INTO users (email, display_name, password_hash, user_kind)
     VALUES ($1, $2, 'hash', 'registered')
     RETURNING id`,
    [`job-claim-${Date.now()}@zhimu.local`, "JobClaim"]
  );
  const userId = user.rows[0].id;
  const jobId = await createAccountDeleteJob(userId, ["slow-object"]);
  await markAccountDeleteJobDbDeleted(jobId);
  await query(
    `UPDATE account_delete_jobs SET updated_at = '2000-01-01T00:00:00Z' WHERE id = $1`,
    [jobId]
  );

  let releasePurge;
  let signalStarted;
  const purgeStarted = new Promise((resolve) => {
    signalStarted = resolve;
  });
  const purgeReleased = new Promise((resolve) => {
    releasePurge = resolve;
  });

  const processing = processPendingAccountDeleteJobs({
    limit: 1,
    claimToken: "00000000-0000-4000-8000-000000000123",
    purge: async (keys) => {
      assert.deepEqual(keys, ["slow-object"]);
      signalStarted();
      await purgeReleased;
      return { purgedCount: 1, failed: [] };
    }
  });

  await purgeStarted;
  const claimed = await query(
    `SELECT status, claim_token, claimed_at FROM account_delete_jobs WHERE id = $1`,
    [jobId]
  );
  assert.equal(claimed.rows[0].status, "storage_processing");
  assert.equal(claimed.rows[0].claim_token, "00000000-0000-4000-8000-000000000123");
  assert.ok(claimed.rows[0].claimed_at);

  const advisoryLocks = await query(
    `SELECT COUNT(*)::int AS count
     FROM pg_locks
     WHERE locktype = 'advisory'
       AND objid = hashtext('zhimu:account-delete-jobs')`
  );
  assert.equal(advisoryLocks.rows[0].count, 0);

  releasePurge();
  const results = await processing;
  assert.deepEqual(
    results.find((item) => item.jobId === jobId),
    { jobId, status: "completed", purgedCount: 1 }
  );

  const completed = await query(
    `SELECT status, claim_token, claimed_at FROM account_delete_jobs WHERE id = $1`,
    [jobId]
  );
  assert.equal(completed.rows[0].status, "completed");
  assert.equal(completed.rows[0].claim_token, null);
  assert.equal(completed.rows[0].claimed_at, null);

  await query(`DELETE FROM account_delete_jobs WHERE id = $1`, [jobId]);
  await query(`DELETE FROM users WHERE id = $1`, [userId]);
});
