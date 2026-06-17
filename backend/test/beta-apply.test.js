import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const OPS_TOKEN = "test-ops-beta-token";

function withOpsToken() {
  const previous = process.env.OPS_API_TOKEN;
  process.env.OPS_API_TOKEN = OPS_TOKEN;
  return () => {
    if (previous === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = previous;
  };
}

test("GET /api/platform/beta returns form config", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/api/platform/beta" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.title, "申请织幕内测");
  assert.ok(Array.isArray(body.roleOptions));
  assert.equal(body.applyApiPath, "/api/platform/beta/apply");
});

test("POST /api/platform/beta/apply creates pending application", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  process.env.EMAIL_DELIVERY_STUB = "1";

  const email = `beta-apply-${Date.now()}@example.invalid`;
  const response = await app.inject({
    method: "POST",
    url: "/api/platform/beta/apply",
    payload: {
      email,
      displayName: "内测申请者",
      roleIntent: "creator",
      useCase: "希望把已有剧本杀整理成可线上跑的自动化房间，并测试主持确认流程。",
      referralSource: "朋友推荐",
      contact: "wechat-demo"
    }
  });
  assert.equal(response.statusCode, 201, response.body);
  const body = response.json();
  assert.equal(body.status, "pending");
  assert.ok(body.id);

  context.after(async () => {
    await query(`DELETE FROM beta_applications WHERE lower(email) = lower($1)`, [email]);
  });

  const duplicate = await app.inject({
    method: "POST",
    url: "/api/platform/beta/apply",
    payload: {
      email,
      displayName: "重复提交",
      useCase: "再次提交应该被拒绝，因为已有待审申请。"
    }
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().code, "BETA_APPLICATION_PENDING");
});

test("ops approve grants beta plan on register", async (context) => {
  const restoreOps = withOpsToken();
  context.after(restoreOps);
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  process.env.EMAIL_DELIVERY_STUB = "1";

  const email = `beta-approved-${Date.now()}@example.invalid`;
  const apply = await app.inject({
    method: "POST",
    url: "/api/platform/beta/apply",
    payload: {
      email,
      displayName: "已通过内测",
      roleIntent: "host",
      useCase: "社团每周线上跑团，需要主持台监控阅读进度与待确认事件队列。"
    }
  });
  const applicationId = apply.json().id;

  const approve = await app.inject({
    method: "POST",
    url: `/api/ops/beta/applications/${applicationId}/approve`,
    headers: { "x-ops-token": OPS_TOKEN },
    payload: { note: "社团主持需求明确" }
  });
  assert.equal(approve.statusCode, 200, approve.body);
  assert.equal(approve.json().status, "approved");

  const register = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, displayName: "已通过内测", password: "test-pass-123" }
  });
  assert.equal(register.statusCode, 201, register.body);
  const userId = register.json().user.id;

  const plan = await query(`SELECT plan_code FROM user_plans WHERE user_id = $1`, [userId]);
  assert.equal(plan.rows[0].plan_code, "beta");

  context.after(async () => {
    await query(`DELETE FROM user_plans WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM storage_quotas WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM beta_applications WHERE id = $1`, [applicationId]);
    await query(`DELETE FROM users WHERE id = $1`, [userId]);
  });
});

test("ops reject requires note", async (context) => {
  const restoreOps = withOpsToken();
  context.after(restoreOps);
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  process.env.EMAIL_DELIVERY_STUB = "1";

  const email = `beta-reject-${Date.now()}@example.invalid`;
  const apply = await app.inject({
    method: "POST",
    url: "/api/platform/beta/apply",
    payload: {
      email,
      displayName: "将被拒绝",
      useCase: "测试拒审流程，需要足够长度的使用说明文字。"
    }
  });
  const applicationId = apply.json().id;

  const reject = await app.inject({
    method: "POST",
    url: `/api/ops/beta/applications/${applicationId}/reject`,
    headers: { "x-ops-token": OPS_TOKEN },
    payload: { note: "暂不开放" }
  });
  assert.equal(reject.statusCode, 200);
  assert.equal(reject.json().status, "rejected");

  context.after(async () => {
    await query(`DELETE FROM beta_applications WHERE id = $1`, [applicationId]);
  });
});
