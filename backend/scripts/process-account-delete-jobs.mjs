#!/usr/bin/env node
/** Retry object storage purge for account delete jobs (cron / ops). */
import { processPendingAccountDeleteJobs } from "../src/account-delete-job.js";

const results = await processPendingAccountDeleteJobs({
  limit: Number(process.env.ACCOUNT_DELETE_JOB_BATCH || 20)
});
console.log(JSON.stringify({ processed: results.length, results }, null, 2));
