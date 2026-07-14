import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import { transactionWithPlatformEvents } from "./transaction-events.js";

async function rejectPlazaPost(client, postId, text) {
  const updated = await client.query(
    `UPDATE play_plaza_posts
     SET review_status = 'rejected', ai_review_note = $2, ai_reviewed_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [postId, text.slice(0, 500)]
  );
  if (!updated.rowCount) throwErr("PLAZA_POST_NOT_FOUND", "帖子不存在。");
}

export async function listPlazaHumanReviewQueue({ limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const [posts, reports] = await Promise.all([
    query(
      `SELECT id, author_user_id, author_display_name, kind, body, review_status,
              ai_review_note, created_at, ai_reviewed_at
       FROM play_plaza_posts
       WHERE deleted_at IS NULL AND review_status = 'human_review'
       ORDER BY created_at ASC
       LIMIT $1 OFFSET $2`,
      [safeLimit, safeOffset]
    ),
    query(
      `SELECT r.id, r.reporter_user_id, r.target_type, r.target_id, r.reason,
              r.human_review_status, r.created_at,
              u.display_name AS reporter_display_name
       FROM play_plaza_reports r
       JOIN users u ON u.id = r.reporter_user_id
       WHERE r.human_review_status = 'open'
       ORDER BY r.created_at ASC
       LIMIT $1 OFFSET $2`,
      [safeLimit, safeOffset]
    )
  ]);
  return {
    posts: posts.rows,
    reports: reports.rows,
    limit: safeLimit,
    offset: safeOffset
  };
}

export async function opsApprovePlazaPost(postId, { note = "" } = {}) {
  await transactionWithPlatformEvents(async (client, events) => {
    const updated = await client.query(
      `UPDATE play_plaza_posts
       SET review_status = 'approved',
           ai_review_note = COALESCE(NULLIF($2, ''), ai_review_note),
           ai_reviewed_at = now(),
           published_at = COALESCE(published_at, now())
       WHERE id = $1 AND deleted_at IS NULL AND review_status IN ('human_review', 'pending', 'rejected')
       RETURNING id`,
      [postId, String(note || "").trim().slice(0, 500)]
    );
    if (!updated.rowCount) throwErr("PLAZA_POST_NOT_FOUND", "帖子不存在或不在待审状态。");
    events.queueBroadcast("plaza.post_created", { postId });
  });
  return { ok: true, postId };
}

export async function opsRejectPlazaPost(postId, { note = "" } = {}) {
  const text = String(note || "").trim();
  if (text.length < 4) throwErr("PLAZA_OPS_NOTE_REQUIRED", "拒审说明至少 4 个字。");
  await transactionWithPlatformEvents(async (client, events) => {
    await rejectPlazaPost(client, postId, text);
    events.queueBroadcast("plaza.post_deleted", { postId });
  });
  return { ok: true, postId };
}

export async function opsResolvePlazaReport(reportId, { dismiss = false, note = "" } = {}) {
  const text = String(note || "").trim();
  const status = dismiss ? "dismissed" : "resolved";
  if (!dismiss && text.length < 4) throwErr("PLAZA_OPS_NOTE_REQUIRED", "处理说明至少 4 个字。");
  await transactionWithPlatformEvents(async (client, events) => {
    const row = await client.query(
      `UPDATE play_plaza_reports
       SET human_review_status = $2, ops_note = $3, resolved_at = now()
       WHERE id = $1 AND human_review_status = 'open'
       RETURNING id, target_type, target_id`,
      [reportId, status, text.slice(0, 500)]
    );
    if (!row.rowCount) throwErr("PLAZA_REPORT_NOT_FOUND", "举报记录不存在或已处理。");
    if (!dismiss && row.rows[0].target_type === "post") {
      await rejectPlazaPost(client, row.rows[0].target_id, text || "经举报复核未通过。");
      events.queueBroadcast("plaza.post_deleted", { postId: row.rows[0].target_id });
    }
  });
  return { ok: true, reportId, status };
}
