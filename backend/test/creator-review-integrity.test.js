import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureWorldId, hostUserId, playerUserId } from "./helpers/fixture-ids.js";

test("creator review enforces target ownership and editor-only resolution", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const reviewerUser = await query(
    `INSERT INTO users (display_name, email) VALUES ($1, $2) RETURNING id`,
    ["creator-reviewer", `creator-reviewer-${Date.now()}@example.test`]
  );
  const reviewerUserId = reviewerUser.rows[0].id;
  const created = await query(
    `INSERT INTO worlds (owner_user_id, name) VALUES ($1, $2) RETURNING id`,
    [hostUserId, `creator-review-${Date.now()}`]
  );
  const worldId = created.rows[0].id;
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
    await query(`DELETE FROM users WHERE id = $1`, [reviewerUserId]);
  });
  await query(
    `INSERT INTO world_members (world_id, user_id, role)
     VALUES ($1, $2, 'owner'), ($1, $3, 'reviewer'), ($1, $4, 'viewer')`,
    [worldId, hostUserId, reviewerUserId, playerUserId]
  );
  const role = await query(
    `INSERT INTO role_slots (world_id, name, private_profile, sequence)
     VALUES ($1, 'review-role', 'reviewer-only-private-profile', 1) RETURNING id`,
    [worldId]
  );
  const version = await query(
    `INSERT INTO content_versions (world_id, created_by_user_id, label, snapshot)
     VALUES ($1, $2, 'review-base', $3::jsonb) RETURNING id`,
    [worldId, hostUserId, JSON.stringify({ world: { id: worldId, name: "before" }, roles: [] })]
  );
  await query(
    `INSERT INTO story_manuscripts (world_id, body, updated_by_user_id)
     VALUES ($1, 'private-review-manuscript', $2)`,
    [worldId, hostUserId]
  );
  const inject = (method, url, userId, payload) => app.inject({
    method,
    url,
    headers: { "x-user-id": userId },
    ...(payload === undefined ? {} : { payload })
  });

  const publicViewerDenied = await inject("GET", `/api/worlds/${worldId}/reviews`, playerUserId);
  assert.equal(publicViewerDenied.statusCode, 403, publicViewerDenied.body);
  assert.equal(publicViewerDenied.json().code, "CREATOR_REVIEW_ACCESS_DENIED");

  const reviewerStudio = await inject("GET", `/api/worlds/${worldId}/studio`, reviewerUserId);
  assert.equal(reviewerStudio.statusCode, 200, reviewerStudio.body);
  assert.equal(reviewerStudio.json().roles[0].private_profile, "reviewer-only-private-profile");
  const publicViewerStudio = await inject("GET", `/api/worlds/${worldId}/studio`, playerUserId);
  assert.equal(publicViewerStudio.statusCode, 200, publicViewerStudio.body);
  assert.equal(publicViewerStudio.json().roles[0].private_profile, "");
  const reviewerManuscript = await inject("GET", `/api/worlds/${worldId}/story-manuscript`, reviewerUserId);
  assert.equal(reviewerManuscript.statusCode, 200, reviewerManuscript.body);
  assert.equal(reviewerManuscript.json().body, "private-review-manuscript");
  const publicViewerManuscript = await inject("GET", `/api/worlds/${worldId}/story-manuscript`, playerUserId);
  assert.equal(publicViewerManuscript.statusCode, 403, publicViewerManuscript.body);
  const publicViewerRules = await inject("GET", `/api/worlds/${worldId}/rules`, playerUserId);
  assert.equal(publicViewerRules.statusCode, 403, publicViewerRules.body);
  const publicViewerAssets = await inject("GET", `/api/worlds/${worldId}/assets`, playerUserId);
  assert.equal(publicViewerAssets.statusCode, 403, publicViewerAssets.body);

  const reviewerExportDenied = await inject("GET", `/api/worlds/${worldId}/content-package`, reviewerUserId);
  assert.equal(reviewerExportDenied.statusCode, 403, reviewerExportDenied.body);
  const reviewerEditDenied = await inject("PATCH", `/api/worlds/${worldId}`, reviewerUserId, {
    name: "reviewer-must-not-edit"
  });
  assert.equal(reviewerEditDenied.statusCode, 403, reviewerEditDenied.body);

  const opened = await inject("POST", `/api/worlds/${worldId}/reviews`, reviewerUserId, {
    targetType: "role",
    targetId: role.rows[0].id,
    targetLabel: "review-role",
    kind: "suggestion",
    severity: "major",
    title: "角色动机需要补强",
    body: "请补充角色在第一幕采取行动的直接动机。",
    suggestedPatch: { privateProfile: "补充动机" }
  });
  assert.equal(opened.statusCode, 201, opened.body);
  const reviewId = opened.json().review.id;
  assert.equal(opened.json().review.impact_scope.scope, "role");

  const foreignRole = await query(
    `SELECT id FROM role_slots WHERE world_id = $1 ORDER BY sequence LIMIT 1`,
    [fixtureWorldId]
  );
  assert.ok(foreignRole.rowCount, "foreign role fixture required");
  const crossWorld = await inject("POST", `/api/worlds/${worldId}/reviews`, reviewerUserId, {
    targetType: "role",
    targetId: foreignRole.rows[0].id,
    body: "cross-world target must not be accepted"
  });
  assert.equal(crossWorld.statusCode, 400, crossWorld.body);
  assert.equal(crossWorld.json().code, "CREATOR_REVIEW_TARGET_INVALID");

  const reviewerResolve = await inject("PATCH", `/api/worlds/${worldId}/reviews/${reviewId}`, reviewerUserId, {
    status: "resolved"
  });
  assert.equal(reviewerResolve.statusCode, 403, reviewerResolve.body);
  assert.equal(reviewerResolve.json().code, "CREATOR_REVIEW_RESOLVE_FORBIDDEN");

  const reply = await inject("POST", `/api/worlds/${worldId}/reviews/${reviewId}/replies`, hostUserId, {
    body: "已补充，等待复核。"
  });
  assert.equal(reply.statusCode, 201, reply.body);
  assert.equal(reply.json().review.parent_id, reviewId);

  const resolved = await inject("PATCH", `/api/worlds/${worldId}/reviews/${reviewId}`, hostUserId, {
    status: "resolved"
  });
  assert.equal(resolved.statusCode, 200, resolved.body);
  assert.equal(resolved.json().review.status, "resolved");
  assert.equal(resolved.json().review.resolved_by_user_id, hostUserId);

  const comparison = await inject(
    "GET",
    `/api/worlds/${worldId}/content-versions/compare?baseVersionId=${version.rows[0].id}`,
    reviewerUserId
  );
  assert.equal(comparison.statusCode, 200, comparison.body);
  assert.ok(comparison.json().comparison.summary.added >= 1);
  assert.equal(JSON.stringify(comparison.json()).includes("补充动机"), false);

  await query(`DELETE FROM users WHERE id = $1`, [reviewerUserId]);
  const retained = await query(
    `SELECT created_by_user_id, body FROM creator_review_threads WHERE id = $1`,
    [reviewId]
  );
  assert.equal(retained.rowCount, 1, "deleting a reviewer must not erase the commercial review record");
  assert.equal(retained.rows[0].created_by_user_id, null);
  assert.equal(retained.rows[0].body, "请补充角色在第一幕采取行动的直接动机。");
});
