import assert from "node:assert/strict";
import test from "node:test";
import { query } from "../src/db.js";
import {
  collectUserObjectKeys,
  createAccountDeleteJob,
  markAccountDeleteJobCompleted,
  markAccountDeleteJobDbDeleted,
  processPendingAccountDeleteJobs
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
