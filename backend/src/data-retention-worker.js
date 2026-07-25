import { pool } from "./db.js";
import { purgeExpiredData } from "./data-retention.js";
import { startNonOverlappingInterval } from "./non-overlapping-interval.js";

export function startDataRetentionWorker({
  intervalMs = Number(process.env.DATA_RETENTION_INTERVAL_MS || 24 * 60 * 60_000),
  log = console
} = {}) {
  const safeInterval = Number.isFinite(intervalMs)
    ? Math.min(Math.max(intervalMs, 60 * 60_000), 7 * 24 * 60 * 60_000)
    : 24 * 60 * 60_000;
  async function tick() {
    const client = await pool.connect();
    let locked = false;
    try {
      const lock = await client.query(
        `SELECT pg_try_advisory_lock(hashtext('zhimu:data-retention')) AS locked`
      );
      locked = Boolean(lock.rows[0]?.locked);
      if (!locked) return;
      const summary = await purgeExpiredData();
      log.info?.({ retention: summary.deleted }, "expired data retention completed");
    } catch (error) {
      log.error?.({ err: error }, "expired data retention failed");
    } finally {
      if (locked) {
        await client.query(
          `SELECT pg_advisory_unlock(hashtext('zhimu:data-retention'))`
        ).catch(() => {});
      }
      client.release();
    }
  }

  const controller = startNonOverlappingInterval(tick, safeInterval, {
    immediate: true,
    onError: (error) => log.error?.({ err: error }, "expired data retention worker failed")
  });
  return () => controller.stop();
}
