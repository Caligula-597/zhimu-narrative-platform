/**
 * User feedback / bug reports / feature requests (P1 公开 Beta 自助闭环).
 */
import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

const VALID_KINDS = new Set(["feedback", "bug", "feature"]);
const VALID_STATUSES = new Set(["new", "seen", "resolved"]);

function sanitizeText(value = "", maxLength = 4000) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

export async function submitFeedback(body, actorId = null) {
  const kind = sanitizeText(body?.kind, 20) || "feedback";
  if (!VALID_KINDS.has(kind)) throwErr("FEEDBACK_KIND_INVALID");

  const subject = sanitizeText(body?.subject, 200);
  const content = sanitizeText(body?.body, 4000);
  if (!subject) throwErr("FEEDBACK_SUBJECT_REQUIRED");
  if (!content) throwErr("FEEDBACK_BODY_REQUIRED");

  const pageUrl = sanitizeText(body?.pageUrl, 500) || null;
  const userAgent = sanitizeText(body?.userAgent, 500) || null;

  const { rows } = await query(
    `INSERT INTO feedback (user_id, kind, subject, body, page_url, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, kind, subject, status, created_at`,
    [actorId, kind, subject, content, pageUrl, userAgent]
  );

  return rows[0];
}

export async function listFeedback({ status, kind, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  if (status) {
    params.push(status);
    conditions.push(`f.status = $${params.length}`);
  }
  if (kind) {
    params.push(kind);
    conditions.push(`f.kind = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT f.id, f.kind, f.subject, f.body, f.page_url, f.user_agent, f.status, f.created_at, f.updated_at,
            u.email AS user_email, u.display_name AS user_name
     FROM feedback f
     LEFT JOIN users u ON f.user_id = u.id
     ${where}
     ORDER BY f.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, Math.min(limit, 200), Math.max(offset, 0)]
  );

  const countResult = await query(
    `SELECT count(*)::int AS total FROM feedback f ${where}`,
    params
  );

  return { items: rows, total: countResult.rows[0]?.total || 0 };
}

export async function getFeedbackStats() {
  const { rows } = await query(
    `SELECT status, count(*)::int AS count FROM feedback GROUP BY status ORDER BY count DESC`
  );
  return rows;
}

export async function updateFeedbackStatus(id, status) {
  if (!VALID_STATUSES.has(status)) throwErr("FEEDBACK_STATUS_INVALID");

  const { rows } = await query(
    `UPDATE feedback SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, status]
  );

  if (!rows.length) throwErr("FEEDBACK_NOT_FOUND");
  return rows[0];
}
