import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { setUserPlan } from "../src/plans.js";
import { buildPlanUpgradeMeta, listUpgradeTargets } from "../src/plan-upgrade-request.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

test("listUpgradeTargets excludes current and lower tiers", () => {
  assert.deepEqual(listUpgradeTargets("free"), ["creator", "studio"]);
  assert.deepEqual(listUpgradeTargets("creator"), ["studio"]);
  assert.deepEqual(listUpgradeTargets("studio"), []);
  assert.deepEqual(listUpgradeTargets("beta"), []);
});

test("GET /account/entitlements includes upgrade meta and plan limits", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: "/api/account/entitlements",
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json();
  assert.ok(body.upgrade?.supportEmail);
  assert.ok(Array.isArray(body.publicPlans));
  assert.ok(body.publicPlans[0]?.limits?.maxWorlds > 0);
});

test("POST /account/plan-upgrade-request stores pending and rejects duplicate", async (context) => {
  const email = `upgrade-${Date.now()}@zhimu.local`;
  const created = await query(
    `INSERT INTO users (email, display_name, password_hash, password_salt, email_verified_at, user_kind)
     VALUES ($1, 'Upgrade User', 'x', 'y', now(), 'registered') RETURNING id`,
    [email]
  );
  const userId = created.rows[0].id;
  context.after(async () => {
    await query(`DELETE FROM plan_upgrade_requests WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM user_plans WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  await setUserPlan(userId, "free");
  const meta = await buildPlanUpgradeMeta(userId, "free");
  assert.equal(meta.canRequest, true);

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const ok = await app.inject({
    method: "POST",
    url: "/api/account/plan-upgrade-request",
    headers: { "x-user-id": userId },
    payload: {
      desiredPlanCode: "creator",
      reason: "已有三部线下剧本，希望扩大存储与剧本数量上限进行内测。",
      contact: "wechat-demo"
    }
  });
  assert.equal(ok.statusCode, 200, ok.body);
  assert.ok(ok.json().id);

  const dup = await app.inject({
    method: "POST",
    url: "/api/account/plan-upgrade-request",
    headers: { "x-user-id": userId },
    payload: {
      desiredPlanCode: "studio",
      reason: "再次提交应该被拒绝因为已有待审申请。"
    }
  });
  assert.equal(dup.statusCode, 409);
  assert.equal(dup.json().code, "PLAN_UPGRADE_REQUEST_PENDING");
});

test("GET /ops/plan-upgrade/requests lists pending", async (context) => {
  const prev = process.env.OPS_API_TOKEN;
  process.env.OPS_API_TOKEN = "test-ops-plan-upgrade";
  context.after(() => {
    if (prev === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = prev;
  });

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: "/api/ops/plan-upgrade/requests?status=pending&limit=5",
    headers: { authorization: "Bearer test-ops-plan-upgrade" }
  });
  assert.equal(res.statusCode, 200, res.body);
  assert.ok(Array.isArray(res.json().items));
});
