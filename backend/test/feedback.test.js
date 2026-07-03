import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const OPS_TOKEN = "test-ops-feedback-token";

function withOpsToken() {
  const previous = process.env.OPS_API_TOKEN;
  process.env.OPS_API_TOKEN = OPS_TOKEN;
  return () => {
    if (previous === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = previous;
  };
}

test("POST /api/feedback creates a feedback entry (public, no auth)", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/feedback",
    payload: {
      kind: "feedback",
      subject: "测试反馈主题",
      body: "这是一条用于测试的反馈详情，描述了使用过程中遇到的情况。",
      pageUrl: "http://localhost:4173/overview",
      userAgent: "test-agent"
    }
  });
  assert.equal(response.statusCode, 201, response.body);
  const body = response.json();
  assert.equal(body.kind, "feedback");
  assert.equal(body.subject, "测试反馈主题");
  assert.equal(body.status, "new");
  assert.ok(body.id);

  context.after(async () => {
    await query(`DELETE FROM feedback WHERE id = $1`, [body.id]);
  });
});

test("POST /api/feedback rejects invalid kind", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/feedback",
    payload: {
      kind: "complaint",
      subject: "无效类型",
      body: "应该被拒绝，因为 kind 不在允许列表内。"
    }
  });
  assert.equal(response.statusCode, 400);
});

test("POST /api/feedback rejects empty subject or body", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const noSubject = await app.inject({
    method: "POST",
    url: "/api/feedback",
    payload: { kind: "bug", body: "只有详情没有主题" }
  });
  assert.equal(noSubject.statusCode, 400);

  const noBody = await app.inject({
    method: "POST",
    url: "/api/feedback",
    payload: { kind: "bug", subject: "只有主题没有详情" }
  });
  assert.equal(noBody.statusCode, 400);
});

test("POST /api/feedback defaults kind to feedback when omitted", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/feedback",
    payload: {
      subject: "省略 kind 的反馈",
      body: "kind 字段未提供，应默认为 feedback。"
    }
  });
  assert.equal(response.statusCode, 201, response.body);
  assert.equal(response.json().kind, "feedback");

  context.after(async () => {
    await query(`DELETE FROM feedback WHERE id = $1`, [response.json().id]);
  });
});

test("GET /api/ops/feedback requires OPS_API_TOKEN", async (context) => {
  const prev = process.env.OPS_API_TOKEN;
  delete process.env.OPS_API_TOKEN;
  context.after(() => {
    if (prev === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = prev;
  });
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/api/ops/feedback" });
  assert.equal(response.statusCode, 503);
});

test("GET /api/ops/feedback returns paginated rows with token", async (context) => {
  const restoreOps = withOpsToken();
  context.after(restoreOps);
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const subject = `ops-list-${Date.now()}`;
  const created = await app.inject({
    method: "POST",
    url: "/api/feedback",
    payload: { kind: "bug", subject, body: "用于测试 ops 列表查询的反馈记录。" }
  });
  assert.equal(created.statusCode, 201, created.body);
  const feedbackId = created.json().id;

  const response = await app.inject({
    method: "GET",
    url: "/api/ops/feedback?kind=bug&limit=10",
    headers: { "x-ops-token": OPS_TOKEN }
  });
  assert.equal(response.statusCode, 200, response.body);
  const body = response.json();
  assert.ok(Array.isArray(body.items));
  assert.equal(typeof body.total, "number");
  assert.ok(body.items.some((item) => item.id === feedbackId));

  context.after(async () => {
    await query(`DELETE FROM feedback WHERE id = $1`, [feedbackId]);
  });
});

test("GET /api/ops/feedback/stats returns status counts", async (context) => {
  const restoreOps = withOpsToken();
  context.after(restoreOps);
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/api/ops/feedback/stats",
    headers: { "x-ops-token": OPS_TOKEN }
  });
  assert.equal(response.statusCode, 200, response.body);
  const body = response.json();
  assert.ok(Array.isArray(body));
});

test("PATCH /api/ops/feedback/:id updates status", async (context) => {
  const restoreOps = withOpsToken();
  context.after(restoreOps);
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/api/feedback",
    payload: { kind: "feature", subject: `patch-${Date.now()}`, body: "测试状态更新流程。" }
  });
  const feedbackId = created.json().id;

  const response = await app.inject({
    method: "PATCH",
    url: `/api/ops/feedback/${feedbackId}`,
    headers: { "x-ops-token": OPS_TOKEN },
    payload: { status: "seen" }
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().status, "seen");

  context.after(async () => {
    await query(`DELETE FROM feedback WHERE id = $1`, [feedbackId]);
  });
});

test("PATCH /api/ops/feedback/:id returns 404 for non-existent id", async (context) => {
  const restoreOps = withOpsToken();
  context.after(restoreOps);
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "PATCH",
    url: "/api/ops/feedback/00000000-0000-0000-0000-000000000000",
    headers: { "x-ops-token": OPS_TOKEN },
    payload: { status: "resolved" }
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, "FEEDBACK_NOT_FOUND");
});
