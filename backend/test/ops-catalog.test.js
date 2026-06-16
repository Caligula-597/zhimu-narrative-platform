import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, playerUserId } from "./helpers/fixture-ids.js";

const OPS_TOKEN = "test-ops-catalog-token";

function withOpsToken() {
  const previous = process.env.OPS_API_TOKEN;
  process.env.OPS_API_TOKEN = OPS_TOKEN;
  return () => {
    if (previous === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = previous;
  };
}

async function createPendingWorld(suffix) {
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status, catalog_review_status, catalog_review_submitted_at)
     VALUES ($1, $2, 'ops catalog fixture', 'testing', 'pending', now())
     RETURNING id, name`,
    [hostUserId, `待审剧本 ${suffix}`]
  );
  await query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`, [
    world.rows[0].id,
    hostUserId
  ]);
  await query(`INSERT INTO role_slots (world_id, name, sequence) VALUES ($1, '角色A', 1)`, [world.rows[0].id]);
  return world.rows[0];
}

test("GET /api/ops/catalog/reviews requires ops token", async (context) => {
  const restore = withOpsToken();
  context.after(restore);
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const missing = await app.inject({ method: "GET", url: "/api/ops/catalog/reviews" });
  assert.equal(missing.statusCode, 401);
  assert.equal(missing.json().code, "OPS_TOKEN_REQUIRED");
});

test("ops catalog approve and reject lifecycle", async (context) => {
  const restore = withOpsToken();
  context.after(restore);
  process.env.EMAIL_DELIVERY_STUB = "1";
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const suffix = `${Date.now()}-${Math.round(Math.random() * 10_000)}`;
  const pending = await createPendingWorld(suffix);
  context.after(async () => {
    await query(`DELETE FROM role_slots WHERE world_id = $1`, [pending.id]);
    await query(`DELETE FROM world_members WHERE world_id = $1`, [pending.id]);
    await query(`DELETE FROM worlds WHERE id = $1`, [pending.id]);
  });

  const headers = { "x-ops-token": OPS_TOKEN };

  const list = await app.inject({ method: "GET", url: "/api/ops/catalog/reviews?limit=20", headers });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().items.some((row) => row.id === pending.id));

  const rejectMissingNote = await app.inject({
    method: "POST",
    url: `/api/ops/catalog/reviews/${pending.id}/reject`,
    headers,
    payload: { note: "短" }
  });
  assert.equal(rejectMissingNote.statusCode, 400);

  const approve = await app.inject({
    method: "POST",
    url: `/api/ops/catalog/reviews/${pending.id}/approve`,
    headers
  });
  assert.equal(approve.statusCode, 200);
  assert.equal(approve.json().world.catalog_review_status, "approved");
  assert.equal(approve.json().world.catalog_public, true);

  const catalog = await app.inject({
    method: "GET",
    url: "/api/worlds/catalog",
    headers: { "x-user-id": playerUserId }
  });
  assert.ok(catalog.json().some((row) => row.id === pending.id));

  const rejectAgain = await app.inject({
    method: "POST",
    url: `/api/ops/catalog/reviews/${pending.id}/reject`,
    headers,
    payload: { note: "已经通过，不能再拒" }
  });
  assert.equal(rejectAgain.statusCode, 409);
  assert.equal(rejectAgain.json().code, "CATALOG_REVIEW_NOT_PENDING");
});

test("ops catalog reject sets note and hides from public catalog", async (context) => {
  const restore = withOpsToken();
  context.after(restore);
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const suffix = `reject-${Date.now()}`;
  const pending = await createPendingWorld(suffix);
  context.after(async () => {
    await query(`DELETE FROM role_slots WHERE world_id = $1`, [pending.id]);
    await query(`DELETE FROM world_members WHERE world_id = $1`, [pending.id]);
    await query(`DELETE FROM worlds WHERE id = $1`, [pending.id]);
  });

  const headers = { "x-ops-token": OPS_TOKEN };
  const reject = await app.inject({
    method: "POST",
    url: `/api/ops/catalog/reviews/${pending.id}/reject`,
    headers,
    payload: { note: "请补充完整分幕后再申请" }
  });
  assert.equal(reject.statusCode, 200);
  assert.equal(reject.json().world.catalog_review_status, "rejected");
  assert.equal(reject.json().world.catalog_review_note, "请补充完整分幕后再申请");
  assert.equal(reject.json().world.catalog_public, false);

  const catalog = await app.inject({
    method: "GET",
    url: "/api/worlds/catalog",
    headers: { "x-user-id": playerUserId }
  });
  assert.ok(!catalog.json().some((row) => row.id === pending.id));
});
