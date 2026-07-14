import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import { transactionWithPlatformEvents } from "./transaction-events.js";
import { reviewPlazaPostContent } from "./play-plaza-ai-review.js";
import { assertPlayAdFree } from "./play-content-moderation.js";
import { assertPlaySocialWrite } from "./play-social-guard.js";

const HOURLY_POST_LIMIT = 12;
const HOURLY_REPLY_LIMIT = 30;

function mapPost(row, actorId = null) {
  return {
    id: row.id,
    kind: row.kind,
    body: row.body,
    authorUserId: row.author_user_id,
    authorDisplayName: row.author_display_name,
    inviteCode: row.invite_code || null,
    roomLabel: row.room_label || null,
    worldLabel: row.world_label || null,
    replyCount: row.reply_count ?? 0,
    reviewStatus: row.review_status || "approved",
    aiReviewNote: row.ai_review_note || null,
    publishedAt: row.published_at || null,
    createdAt: row.created_at,
    isMine: actorId ? row.author_user_id === actorId : false
  };
}

function mapReply(row, actorId = null) {
  return {
    id: row.id,
    postId: row.post_id,
    parentReplyId: row.parent_reply_id || null,
    body: row.body,
    authorUserId: row.author_user_id,
    authorDisplayName: row.author_display_name,
    createdAt: row.created_at,
    isMine: actorId ? row.author_user_id === actorId : false
  };
}

async function resolveInviteLabels(inviteCode) {
  if (!inviteCode) return { roomLabel: null, worldLabel: null };
  const result = await query(
    `SELECT r.name AS room_name, w.name AS world_name
     FROM rooms r
     JOIN worlds w ON w.id = r.world_id
     WHERE r.invite_code = $1 AND w.status <> 'archived'`,
    [inviteCode]
  );
  if (!result.rowCount) return { roomLabel: null, worldLabel: null };
  return {
    roomLabel: result.rows[0].room_name,
    worldLabel: result.rows[0].world_name
  };
}

async function fetchPostRow(postId) {
  const result = await query(
    `SELECT id, author_user_id, author_display_name, kind, body, invite_code,
            room_label, world_label, reply_count, review_status, ai_review_note,
            published_at, created_at, deleted_at
     FROM play_plaza_posts
     WHERE id = $1`,
    [postId]
  );
  return result.rows[0] || null;
}

function assertPostVisible(row, actorId = null) {
  if (!row || row.deleted_at) throwErr("PLAZA_POST_NOT_FOUND", "帖子不存在或已删除。");
  if (row.review_status === "approved") return;
  if (actorId && row.author_user_id === actorId) return;
  throwErr("PLAZA_POST_NOT_FOUND", "帖子不存在或尚未公开展示。");
}

export async function listPlazaPosts({ kind, limit = 40, actorId = null }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 60);
  const params = [safeLimit];
  let filters = "WHERE deleted_at IS NULL AND review_status = 'approved'";
  if (kind === "chat" || kind === "recruit") {
    filters += " AND kind = $2";
    params.push(kind);
  }
  const result = await query(
    `SELECT id, author_user_id, author_display_name, kind, body, invite_code,
            room_label, world_label, reply_count, review_status, ai_review_note,
            published_at, created_at
     FROM play_plaza_posts
     ${filters}
     ORDER BY COALESCE(published_at, created_at) DESC
     LIMIT $1`,
    params
  );
  return {
    total: result.rowCount,
    items: result.rows.map((row) => mapPost(row, actorId))
  };
}

export async function getPlazaPost(postId, actorId = null) {
  const row = await fetchPostRow(postId);
  assertPostVisible(row, actorId);
  return mapPost(row, actorId);
}

export async function listPlazaReplies(postId, { limit = 100, actorId = null } = {}) {
  await getPlazaPost(postId, actorId);
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const result = await query(
    `SELECT id, post_id, parent_reply_id, author_user_id, author_display_name, body, created_at
     FROM play_plaza_replies
     WHERE post_id = $1 AND deleted_at IS NULL
     ORDER BY created_at ASC
     LIMIT $2`,
    [postId, safeLimit]
  );
  return { items: result.rows.map((row) => mapReply(row, actorId)) };
}

export async function createPlazaPost({ actorId, kind, body, inviteCode }) {
  await assertPlaySocialWrite(actorId);
  const normalizedKind = kind === "recruit" ? "recruit" : "chat";
  const text = String(body ?? "").trim();
  if (!text || text.length > 500) throwErr("PLAZA_POST_INVALID", "发言内容需为 1～500 字。");
  assertPlayAdFree(text);

  const recent = await query(
    `SELECT COUNT(*)::int AS count FROM play_plaza_posts
     WHERE author_user_id = $1 AND created_at > now() - interval '1 hour'`,
    [actorId]
  );
  if (recent.rows[0].count >= HOURLY_POST_LIMIT) throwErr("RATE_LIMITED", "发帖过于频繁，请稍后再试。");

  let code = null;
  let roomLabel = null;
  let worldLabel = null;
  if (normalizedKind === "recruit" && inviteCode) {
    code = String(inviteCode).trim().slice(0, 80);
    if (code) {
      const labels = await resolveInviteLabels(code);
      roomLabel = labels.roomLabel;
      worldLabel = labels.worldLabel;
    }
  }

  const user = await query(`SELECT display_name FROM users WHERE id = $1`, [actorId]);
  const authorName = user.rows[0]?.display_name || "玩家";

  const inserted = await query(
    `INSERT INTO play_plaza_posts
       (author_user_id, author_display_name, kind, body, invite_code, room_label, world_label, review_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     RETURNING id, author_user_id, author_display_name, kind, body, invite_code, room_label, world_label,
               reply_count, review_status, ai_review_note, published_at, created_at`,
    [actorId, authorName.slice(0, 40), normalizedKind, text, code, roomLabel, worldLabel]
  );
  const postId = inserted.rows[0].id;

  const verdict = await reviewPlazaPostContent({ body: text, kind: normalizedKind });
  const reviewedAt = new Date().toISOString();

  if (verdict.decision === "reject") {
    await query(
      `UPDATE play_plaza_posts
       SET review_status = 'rejected', ai_review_note = $2, ai_reviewed_at = $3
       WHERE id = $1`,
      [postId, verdict.feedback || verdict.reason, reviewedAt]
    );
    throwErr("PLAZA_POST_REJECTED", verdict.feedback || "帖子未通过审核，请修改后重试。");
  }

  if (verdict.decision === "human_review") {
    await query(
      `UPDATE play_plaza_posts
       SET review_status = 'human_review', ai_review_note = $2, ai_reviewed_at = $3
       WHERE id = $1`,
      [postId, verdict.reason, reviewedAt]
    );
    return {
      ...mapPost(
        {
          ...inserted.rows[0],
          review_status: "human_review",
          ai_review_note: verdict.reason,
          published_at: null
        },
        actorId
      ),
      reviewPending: true,
      message: "帖子已提交，等待人工复核通过后将展示在广场。"
    };
  }

  const approved = await transactionWithPlatformEvents(async (client, events) => {
    const result = await client.query(
      `UPDATE play_plaza_posts
       SET review_status = 'approved',
           ai_review_note = $2,
           ai_reviewed_at = $3,
           published_at = now()
       WHERE id = $1
       RETURNING id, author_user_id, author_display_name, kind, body, invite_code, room_label, world_label,
                 reply_count, review_status, ai_review_note, published_at, created_at`,
      [postId, verdict.reason, reviewedAt]
    );
    events.queueBroadcast("plaza.post_created", { postId });
    return result;
  });
  const post = mapPost(approved.rows[0], actorId);
  return post;
}

export async function createPlazaReply({ actorId, postId, body, parentReplyId = null }) {
  await assertPlaySocialWrite(actorId);
  const text = String(body ?? "").trim();
  if (!text || text.length > 500) throwErr("PLAZA_REPLY_INVALID", "评论内容需为 1～500 字。");
  assertPlayAdFree(text);
  await getPlazaPost(postId, actorId);

  if (parentReplyId) {
    const parent = await query(
      `SELECT id FROM play_plaza_replies WHERE id = $1 AND post_id = $2 AND deleted_at IS NULL`,
      [parentReplyId, postId]
    );
    if (!parent.rowCount) throwErr("PLAZA_REPLY_NOT_FOUND", "回复的评论不存在。");
  }

  const recent = await query(
    `SELECT COUNT(*)::int AS count FROM play_plaza_replies
     WHERE author_user_id = $1 AND created_at > now() - interval '1 hour'`,
    [actorId]
  );
  if (recent.rows[0].count >= HOURLY_REPLY_LIMIT) throwErr("RATE_LIMITED", "评论过于频繁，请稍后再试。");

  const user = await query(`SELECT display_name FROM users WHERE id = $1`, [actorId]);
  const authorName = user.rows[0]?.display_name || "玩家";

  const inserted = await transactionWithPlatformEvents(async (client, events) => {
    const result = await client.query(
      `INSERT INTO play_plaza_replies (post_id, author_user_id, author_display_name, body, parent_reply_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, post_id, parent_reply_id, author_user_id, author_display_name, body, created_at`,
      [postId, actorId, authorName.slice(0, 40), text, parentReplyId || null]
    );
    await client.query(`UPDATE play_plaza_posts SET reply_count = reply_count + 1 WHERE id = $1`, [postId]);
    events.queueBroadcast("plaza.reply_created", { postId, replyId: result.rows[0].id });
    return result;
  });
  const reply = mapReply(inserted.rows[0], actorId);
  return reply;
}

export async function deletePlazaPost(actorId, postId) {
  await transactionWithPlatformEvents(async (client, events) => {
    const result = await client.query(
      `UPDATE play_plaza_posts SET deleted_at = now()
       WHERE id = $1 AND author_user_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [postId, actorId]
    );
    if (!result.rowCount) throwErr("PLAZA_POST_NOT_FOUND", "只能删除自己的帖子。");
    events.queueBroadcast("plaza.post_deleted", { postId });
  });
  return { ok: true };
}

export async function deletePlazaReply(actorId, replyId) {
  const row = await query(
    `SELECT id, post_id FROM play_plaza_replies WHERE id = $1 AND deleted_at IS NULL`,
    [replyId]
  );
  if (!row.rowCount) throwErr("PLAZA_REPLY_NOT_FOUND", "评论不存在。");
  await transactionWithPlatformEvents(async (client, events) => {
    const updated = await client.query(
      `UPDATE play_plaza_replies SET deleted_at = now()
       WHERE id = $1 AND author_user_id = $2 AND deleted_at IS NULL
       RETURNING id, post_id`,
      [replyId, actorId]
    );
    if (!updated.rowCount) throwErr("FORBIDDEN", "只能删除自己的评论。");
    await client.query(
      `UPDATE play_plaza_posts SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = $1`,
      [updated.rows[0].post_id]
    );
    events.queueBroadcast("plaza.reply_deleted", { postId: updated.rows[0].post_id, replyId });
  });
  return { ok: true };
}

export async function reportPlazaTarget({ actorId, targetType, targetId, reason }) {
  const normalizedType = targetType === "reply" ? "reply" : "post";
  const text = String(reason ?? "").trim();
  if (text.length < 4 || text.length > 200) throwErr("PLAZA_REPORT_INVALID", "举报说明需 4～200 字。");

  if (normalizedType === "post") {
    const post = await query(
      `SELECT author_user_id, review_status FROM play_plaza_posts WHERE id = $1 AND deleted_at IS NULL`,
      [targetId]
    );
    if (!post.rowCount) throwErr("PLAZA_POST_NOT_FOUND", "帖子不存在。");
    if (post.rows[0].author_user_id === actorId) throwErr("PLAZA_REPORT_SELF", "不能举报自己的内容。");
  } else {
    const reply = await query(
      `SELECT author_user_id FROM play_plaza_replies WHERE id = $1 AND deleted_at IS NULL`,
      [targetId]
    );
    if (!reply.rowCount) throwErr("PLAZA_REPLY_NOT_FOUND", "评论不存在。");
    if (reply.rows[0].author_user_id === actorId) throwErr("PLAZA_REPORT_SELF", "不能举报自己的内容。");
  }

  await transactionWithPlatformEvents(async (client, events) => {
    await client.query(
      `INSERT INTO play_plaza_reports (reporter_user_id, target_type, target_id, reason, human_review_status)
       VALUES ($1, $2, $3, $4, 'open')
       ON CONFLICT (reporter_user_id, target_type, target_id) DO UPDATE
         SET reason = EXCLUDED.reason,
             human_review_status = 'open',
             created_at = now(),
             resolved_at = NULL,
             ops_note = NULL`,
      [actorId, normalizedType, targetId, text]
    );
    if (normalizedType === "post") {
      await client.query(
        `UPDATE play_plaza_posts
         SET review_status = 'human_review'
         WHERE id = $1 AND deleted_at IS NULL AND review_status = 'approved'`,
        [targetId]
      );
      events.queueBroadcast("plaza.post_deleted", { postId: targetId, reason: "reported" });
    }
  });

  return { ok: true, message: "举报已提交，我们将进行人工复核。" };
}
