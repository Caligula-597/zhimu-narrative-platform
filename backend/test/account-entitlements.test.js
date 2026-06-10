import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { buildAccountEntitlements, assignUserPlanByEmail } from "../src/account-entitlements.js";
import { setUserPlan } from "../src/plans.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

test("GET /account/entitlements returns plan usage and capabilities", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: "/api/account/entitlements",
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json();
  assert.ok(body.plan?.code);
  assert.ok(body.usage?.maxBytes > 0);
  assert.equal(typeof body.capabilities["world.create"], "boolean");
  assert.ok(Array.isArray(body.publicPlans));
  assert.equal(body.publicPlans.some((p) => p.code === "beta"), false);
});

test("assignUserPlanByEmail updates plan for registered user", async (context) => {
  const email = `plan-assign-${Date.now()}@zhimu.local`;
  const created = await query(
    `INSERT INTO users (email, display_name, password_hash, password_salt, email_verified_at)
     VALUES ($1, 'Plan Assign', 'x', 'y', now()) RETURNING id`,
    [email]
  );
  const userId = created.rows[0].id;
  context.after(async () => {
    await query(`DELETE FROM user_plans WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  await assignUserPlanByEmail(email, "creator");
  const entitlements = await buildAccountEntitlements(userId);
  assert.equal(entitlements.plan.code, "creator");
});

test("POST /ops/users/plan requires OPS token", async (context) => {
  const prev = process.env.OPS_API_TOKEN;
  process.env.OPS_API_TOKEN = "test-ops-token";
  context.after(() => {
    if (prev === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = prev;
  });

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const denied = await app.inject({
    method: "POST",
    url: "/api/ops/users/plan",
    payload: { email: "host@zhimu.local", planCode: "beta" }
  });
  assert.equal(denied.statusCode, 401);

  const ok = await app.inject({
    method: "POST",
    url: "/api/ops/users/plan",
    headers: { authorization: "Bearer test-ops-token" },
    payload: { email: "host@zhimu.local", planCode: "beta" }
  });
  assert.equal(ok.statusCode, 200, ok.body);
  assert.equal(ok.json().planCode, "beta");

  const before = (await query(`SELECT plan_code FROM user_plans WHERE user_id = $1`, [hostUserId])).rows[0]?.plan_code;
  context.after(async () => {
    if (before) await setUserPlan(hostUserId, before);
  });
});
