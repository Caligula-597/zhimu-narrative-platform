import { pool } from "./db.js";
import { reviewPlazaPostContent } from "./play-plaza-ai-review.js";
import { transactionWithPlatformEvents } from "./transaction-events.js";
import { startNonOverlappingInterval } from "./non-overlapping-interval.js";

async function processPendingPlazaPosts({ limit = 20 } = {}) {
  const client = await pool.connect();
  let pending;
  try {
    await client.query("BEGIN");
    pending = await client.query(
      `WITH candidates AS (
         SELECT id
         FROM play_plaza_posts
         WHERE deleted_at IS NULL
           AND review_status = 'pending'
           AND created_at < now() - interval '30 seconds'
           AND (
             ai_reviewed_at IS NULL
             OR ai_reviewed_at < now() - interval '5 minutes'
           )
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE play_plaza_posts post
       SET ai_reviewed_at = now(),
           ai_review_note = 'review_processing'
       FROM candidates
       WHERE post.id = candidates.id
       RETURNING post.id, post.body, post.kind`,
      [limit]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  async function reviewClaimedPost(post) {
    const verdict = await reviewPlazaPostContent({ body: post.body, kind: post.kind });
    if (verdict.decision === "approve") {
      await transactionWithPlatformEvents(async (transactionClient, events) => {
        const updated = await transactionClient.query(
          `UPDATE play_plaza_posts
           SET review_status = 'approved',
               ai_review_note = $2,
               ai_reviewed_at = now(),
               published_at = COALESCE(published_at, now())
           WHERE id = $1
             AND deleted_at IS NULL
             AND review_status = 'pending'
             AND ai_review_note = 'review_processing'
           RETURNING id`,
          [post.id, verdict.reason]
        );
        if (updated.rowCount) events.queueBroadcast("plaza.post_created", { postId: post.id });
      });
    } else {
      await pool.query(
        `UPDATE play_plaza_posts
         SET review_status = $2,
             ai_review_note = $3,
             ai_reviewed_at = now()
         WHERE id = $1
           AND deleted_at IS NULL
           AND review_status = 'pending'
           AND ai_review_note = 'review_processing'`,
        [
          post.id,
          verdict.decision === "reject" ? "rejected" : "human_review",
          verdict.feedback || verdict.reason
        ]
      );
    }
    return { postId: post.id, decision: verdict.decision };
  }

  const results = [];
  const concurrency = 4;
  for (let index = 0; index < pending.rows.length; index += concurrency) {
    const batch = pending.rows.slice(index, index + concurrency);
    results.push(...await Promise.all(batch.map(reviewClaimedPost)));
  }
  return results;
}

export function startPlazaReviewWorker({
  intervalMs = Number(process.env.PLAZA_REVIEW_INTERVAL_MS || 60_000),
  log = console
} = {}) {
  const safeInterval = Number.isFinite(intervalMs)
    ? Math.min(Math.max(intervalMs, 30_000), 15 * 60_000)
    : 60_000;
  async function tick() {
    const results = await processPendingPlazaPosts({ limit: 20 });
    if (results.length) log.info?.({ posts: results }, "pending plaza reviews processed");
  }

  const controller = startNonOverlappingInterval(tick, safeInterval, {
    immediate: true,
    onError: (error) => log.error?.({ err: error }, "pending plaza review worker failed")
  });
  return () => controller.stop();
}

export { processPendingPlazaPosts };
