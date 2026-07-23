import { processPendingAccountDeleteJobs } from "./account-delete-job.js";
import { startNonOverlappingInterval } from "./non-overlapping-interval.js";

export function startAccountDeleteJobWorker({
  intervalMs = Number(process.env.ACCOUNT_DELETE_JOB_INTERVAL_MS || 5 * 60_000),
  log = console
} = {}) {
  const safeInterval = Number.isFinite(intervalMs)
    ? Math.min(Math.max(intervalMs, 60_000), 60 * 60_000)
    : 5 * 60_000;
  async function tick() {
    const results = await processPendingAccountDeleteJobs({ limit: 20 });
    if (results.length) log.info?.({ jobs: results }, "account delete storage cleanup completed");
  }

  const controller = startNonOverlappingInterval(tick, safeInterval, {
    immediate: true,
    onError: (error) => log.error?.({ err: error }, "account delete storage cleanup failed")
  });
  return () => controller.stop();
}
