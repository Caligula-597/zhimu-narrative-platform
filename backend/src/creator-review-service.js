import { transaction } from "./db.js";
import { throwErr } from "./api-errors.js";
import { compareCreatorSnapshots } from "./creator-review-diff.js";
import {
  calculateCreatorReviewImpact,
  configureCreatorReviewTransaction,
  findCreatorReview,
  insertCreatorReview,
  listCreatorReviews,
  loadContentVersionSnapshot,
  loadCreatorReviewAccess,
  targetBelongsToWorld,
  touchCreatorReview,
  updateCreatorReview
} from "./repositories/creator-review-repository.js";
import { buildWorldArchiveSnapshot } from "./world-snapshot-service.js";

const REVIEW_ROLES = new Set(["owner", "editor", "reviewer"]);
const EDITOR_ROLES = new Set(["owner", "editor"]);
const MAX_REVIEW_JSON_BYTES = 32 * 1024;

function assertReviewJson(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throwErr("CREATOR_REVIEW_PAYLOAD_INVALID");
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_REVIEW_JSON_BYTES) {
    throwErr("CREATOR_REVIEW_PAYLOAD_TOO_LARGE");
  }
}

async function assertReviewAccess(client, { worldId, actorId, lock = false }) {
  const role = await loadCreatorReviewAccess(client, { worldId, actorId, lock });
  if (!role || !REVIEW_ROLES.has(role)) throwErr("CREATOR_REVIEW_ACCESS_DENIED");
  return role;
}

export async function getCreatorReviews({ worldId, actorId, status, targetType, limit }) {
  return transaction(async (client) => {
    await configureCreatorReviewTransaction(client);
    await assertReviewAccess(client, { worldId, actorId });
    const reviews = await listCreatorReviews({ worldId, status, targetType, limit, client });
    return { reviews };
  });
}

export async function createCreatorReview({ worldId, actorId, payload }) {
  return transaction(async (client) => {
    await configureCreatorReviewTransaction(client);
    await assertReviewAccess(client, { worldId, actorId, lock: true });
    assertReviewJson(payload.anchor || {});
    assertReviewJson(payload.suggestedPatch || {});
    if (!await targetBelongsToWorld(client, {
      worldId,
      targetType: payload.targetType,
      targetId: payload.targetId || null
    })) throwErr("CREATOR_REVIEW_TARGET_INVALID");
    const impactScope = await calculateCreatorReviewImpact(client, {
      worldId,
      targetType: payload.targetType,
      targetId: payload.targetId || null
    });
    const review = await insertCreatorReview(client, {
      worldId,
      actorId,
      targetType: payload.targetType,
      targetId: payload.targetId || null,
      targetLabel: payload.targetLabel || "",
      anchor: payload.anchor || {},
      kind: payload.kind || "comment",
      severity: payload.severity || "note",
      title: payload.title || "",
      body: payload.body,
      suggestedPatch: payload.suggestedPatch || {},
      impactScope
    });
    return { review };
  });
}

export async function replyToCreatorReview({ worldId, reviewId, actorId, body }) {
  return transaction(async (client) => {
    await configureCreatorReviewTransaction(client);
    await assertReviewAccess(client, { worldId, actorId, lock: true });
    const requestedParent = await findCreatorReview(client, { worldId, reviewId, lock: true });
    if (!requestedParent) throwErr("CREATOR_REVIEW_NOT_FOUND");
    const parent = requestedParent.parent_id
      ? await findCreatorReview(client, { worldId, reviewId: requestedParent.parent_id, lock: true })
      : requestedParent;
    if (!parent) throwErr("CREATOR_REVIEW_NOT_FOUND");
    const review = await insertCreatorReview(client, {
      worldId,
      actorId,
      parentId: parent.id,
      targetType: parent.target_type,
      targetId: parent.target_id,
      targetLabel: parent.target_label,
      anchor: parent.anchor,
      kind: "comment",
      severity: "note",
      body,
      impactScope: parent.impact_scope
    });
    await touchCreatorReview(client, { worldId, reviewId: parent.id });
    return { review };
  });
}

export async function patchCreatorReview({ worldId, reviewId, actorId, payload }) {
  return transaction(async (client) => {
    await configureCreatorReviewTransaction(client);
    const role = await assertReviewAccess(client, { worldId, actorId, lock: true });
    const current = await findCreatorReview(client, { worldId, reviewId, lock: true });
    if (!current) throwErr("CREATOR_REVIEW_NOT_FOUND");
    const isEditor = EDITOR_ROLES.has(role);
    const isAuthor = current.created_by_user_id === actorId;
    if (!isEditor && !isAuthor) throwErr("CREATOR_REVIEW_EDIT_FORBIDDEN");
    if (!isEditor && current.status !== "open") throwErr("CREATOR_REVIEW_EDIT_FORBIDDEN");
    if (!isEditor && payload.status && payload.status !== current.status) {
      throwErr("CREATOR_REVIEW_RESOLVE_FORBIDDEN");
    }
    assertReviewJson(payload.suggestedPatch ?? current.suggested_patch);
    const review = await updateCreatorReview(client, {
      worldId,
      reviewId,
      actorId,
      title: payload.title ?? current.title,
      body: payload.body ?? current.body,
      kind: payload.kind ?? current.kind,
      severity: payload.severity ?? current.severity,
      status: payload.status ?? current.status,
      suggestedPatch: payload.suggestedPatch ?? current.suggested_patch
    });
    return { review };
  });
}

export async function compareCreatorVersions({ worldId, actorId, baseVersionId, headVersionId }) {
  return transaction(async (client) => {
    await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await configureCreatorReviewTransaction(client);
    await assertReviewAccess(client, { worldId, actorId });
    const base = await loadContentVersionSnapshot(client, { worldId, versionId: baseVersionId });
    if (!base) throwErr("CONTENT_VERSION_NOT_FOUND");
    const head = headVersionId
      ? await loadContentVersionSnapshot(client, { worldId, versionId: headVersionId })
      : { id: null, label: "当前内容", created_at: null, snapshot: await buildWorldArchiveSnapshot(worldId, client) };
    if (!head) throwErr("CONTENT_VERSION_NOT_FOUND");
    return {
      base: { id: base.id, label: base.label, createdAt: base.created_at },
      head: { id: head.id, label: head.label, createdAt: head.created_at },
      comparison: compareCreatorSnapshots(base.snapshot, head.snapshot)
    };
  });
}
