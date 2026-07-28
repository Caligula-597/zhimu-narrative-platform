/**
 * Ops-only catalog review actions (list / approve / reject).
 */
import { throwErr } from "./api-errors.js";
import { query } from "./db.js";

const REVIEW_LIST_SQL = `
  SELECT w.id, w.name, w.summary, w.status,
         w.catalog_public, w.catalog_review_status,
         w.catalog_review_submitted_at, w.catalog_review_note,
         u.id AS owner_user_id,
         COALESCE((
           SELECT profile.display_name FROM user_portal_profiles profile
           WHERE profile.user_id = u.id AND profile.portal = 'creator'
         ), u.display_name) AS owner_display_name,
         u.email AS owner_email,
         (SELECT COUNT(*)::int FROM role_slots rs WHERE rs.world_id = w.id) AS role_count
  FROM worlds w
  JOIN users u ON u.id = w.owner_user_id
  WHERE w.catalog_review_status = 'pending'
  ORDER BY w.catalog_review_submitted_at ASC NULLS LAST, w.updated_at ASC
  LIMIT $1 OFFSET $2
`;

export async function countPendingCatalogReviews() {
  const result = await query(
    `SELECT COUNT(*)::int AS total FROM worlds WHERE catalog_review_status = 'pending'`
  );
  return result.rows[0]?.total ?? 0;
}

export async function listPendingCatalogReviews({ limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const [items, total] = await Promise.all([
    query(REVIEW_LIST_SQL, [safeLimit, safeOffset]),
    countPendingCatalogReviews()
  ]);
  return {
    items: items.rows,
    total,
    limit: safeLimit,
    offset: safeOffset
  };
}

export async function getCatalogReviewWorld(worldId) {
  const result = await query(
    `SELECT w.id, w.name, w.summary, w.status,
            w.catalog_public, w.catalog_review_status,
            w.catalog_review_submitted_at, w.catalog_review_note
     FROM worlds w
     WHERE w.id = $1`,
    [worldId]
  );
  if (!result.rowCount) throwErr("WORLD_NOT_FOUND");
  return result.rows[0];
}

export async function approveCatalogReview(worldId) {
  const world = await getCatalogReviewWorld(worldId);
  if (world.catalog_review_status !== "pending") {
    throwErr("CATALOG_REVIEW_NOT_PENDING", "仅「审核中」的申请可通过");
  }
  const updated = await query(
    `UPDATE worlds
     SET catalog_public = true,
         catalog_review_status = 'approved',
         catalog_review_note = NULL,
         updated_at = now()
     WHERE id = $1
     RETURNING id, name, summary, status, catalog_public, catalog_review_status,
               catalog_review_submitted_at, catalog_review_note, updated_at`,
    [worldId]
  );
  return updated.rows[0];
}

export async function rejectCatalogReview(worldId, note) {
  const trimmed = String(note || "").trim();
  if (trimmed.length < 4) {
    throwErr("CATALOG_REVIEW_REJECT_NOTE_REQUIRED", "拒审说明至少 4 个字");
  }
  const world = await getCatalogReviewWorld(worldId);
  if (world.catalog_review_status !== "pending") {
    throwErr("CATALOG_REVIEW_NOT_PENDING", "仅「审核中」的申请可拒绝");
  }
  const updated = await query(
    `UPDATE worlds
     SET catalog_public = false,
         catalog_review_status = 'rejected',
         catalog_review_note = $2,
         updated_at = now()
     WHERE id = $1
     RETURNING id, name, summary, status, catalog_public, catalog_review_status,
               catalog_review_submitted_at, catalog_review_note, updated_at`,
    [worldId, trimmed]
  );
  return updated.rows[0];
}
