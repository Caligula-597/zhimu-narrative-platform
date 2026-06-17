import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { resetRateLimitersForTests } from "../src/rate-limit.js";
import { resolveAllowedCorsOrigins } from "../src/cors-origins.js";

test("resolveAllowedCorsOrigins merges marketing and app origins", () => {
  const prevCors = process.env.CORS_ORIGIN;
  const prevMarketing = process.env.MARKETING_SITE_ORIGIN;
  process.env.CORS_ORIGIN = "https://app.getzhimu.com";
  process.env.MARKETING_SITE_ORIGIN = "https://getzhimu.com,https://www.getzhimu.com";
  try {
    const origins = resolveAllowedCorsOrigins({}, "production");
    assert.ok(Array.isArray(origins));
    assert.deepEqual(origins.sort(), [
      "https://app.getzhimu.com",
      "https://getzhimu.com",
      "https://www.getzhimu.com"
    ]);
  } finally {
    if (prevCors === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = prevCors;
    if (prevMarketing === undefined) delete process.env.MARKETING_SITE_ORIGIN;
    else process.env.MARKETING_SITE_ORIGIN = prevMarketing;
  }
});

test("GET /api/platform/site returns marketing bootstrap without auth", async (context) => {
  const prevPlay = process.env.PLAY_SITE_ORIGIN;
  process.env.PLAY_SITE_ORIGIN = "https://play.getzhimu.com";
  context.after(() => {
    if (prevPlay === undefined) delete process.env.PLAY_SITE_ORIGIN;
    else process.env.PLAY_SITE_ORIGIN = prevPlay;
  });

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/api/platform/site" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.product.name, "织幕");
  assert.ok(body.links);
  assert.equal(body.links.playerJoin, "https://play.getzhimu.com");
  assert.ok(body.beta?.roleOptions?.length >= 5);
  assert.ok(body.officialExample);
  assert.ok(body.catalog);
  assert.equal(body.apis.site, "/api/platform/site");
  assert.ok(body.fetchedAt);
});

test("GET /api/platform/catalog-preview is public", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/api/platform/catalog-preview?limit=3"
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(Array.isArray(body.items));
  assert.ok(body.total >= 0);
});

test("marketing origin receives CORS headers on platform site", async (context) => {
  const app = await createApp({
    logger: false,
    allowDemoUserHeader: true,
    corsOrigin: ["https://getzhimu.com", "https://app.getzhimu.com"]
  });
  context.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/api/platform/site",
    headers: { origin: "https://getzhimu.com" }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["access-control-allow-origin"], "https://getzhimu.com");
});

test("OPTIONS preflight for beta apply from marketing origin", async (context) => {
  const app = await createApp({
    logger: false,
    allowDemoUserHeader: true,
    corsOrigin: "https://getzhimu.com"
  });
  context.after(() => app.close());

  const response = await app.inject({
    method: "OPTIONS",
    url: "/api/platform/beta/apply",
    headers: {
      origin: "https://getzhimu.com",
      "access-control-request-method": "POST"
    }
  });
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["access-control-allow-origin"], "https://getzhimu.com");
});

test("beta apply honeypot returns success without inserting row", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const email = `honeypot-${Date.now()}@example.invalid`;
  const response = await app.inject({
    method: "POST",
    url: "/api/platform/beta/apply",
    payload: {
      email,
      displayName: "Bot",
      useCase: "这是足够长的垃圾说明文字，用于测试蜜罐字段拦截逻辑。",
      companyWebsite: "https://spam.example"
    }
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().id, null);

  const rows = await query(`SELECT id FROM beta_applications WHERE lower(email) = lower($1)`, [email]);
  assert.equal(rows.rowCount, 0);
});

test("beta apply closed when BETA_APPLICATIONS_OPEN=false", async (context) => {
  const previous = process.env.BETA_APPLICATIONS_OPEN;
  process.env.BETA_APPLICATIONS_OPEN = "false";
  context.after(() => {
    if (previous === undefined) delete process.env.BETA_APPLICATIONS_OPEN;
    else process.env.BETA_APPLICATIONS_OPEN = previous;
  });

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/platform/beta/apply",
    payload: {
      email: `closed-${Date.now()}@example.invalid`,
      displayName: "申请者",
      useCase: "测试关闭内测申请入口时的错误码与提示信息返回。"
    }
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().code, "BETA_APPLICATIONS_CLOSED");
});

test("rejected beta application can submit again", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  process.env.EMAIL_DELIVERY_STUB = "1";

  const email = `beta-reapply-${Date.now()}@example.invalid`;
  const first = await app.inject({
    method: "POST",
    url: "/api/platform/beta/apply",
    payload: {
      email,
      displayName: "第一次",
      useCase: "第一次提交内测申请，后续会被拒绝并再次提交。"
    }
  });
  assert.equal(first.statusCode, 201);

  await query(
    `UPDATE beta_applications SET status = 'rejected', review_note = '请补充', reviewed_at = now() WHERE lower(email) = lower($1)`,
    [email]
  );

  const second = await app.inject({
    method: "POST",
    url: "/api/platform/beta/apply",
    payload: {
      email,
      displayName: "第二次",
      useCase: "拒绝后再次提交，应该成功进入待审队列。"
    }
  });
  assert.equal(second.statusCode, 201, second.body);
  assert.equal(second.json().status, "pending");

  context.after(async () => {
    await query(`DELETE FROM beta_applications WHERE lower(email) = lower($1)`, [email]);
  });
});

test("beta apply rate limit blocks excessive submissions", async (context) => {
  resetRateLimitersForTests();
  const app = await createApp({ logger: false, allowDemoUserHeader: true, rateLimit: true });
  context.after(() => app.close());
  process.env.EMAIL_DELIVERY_STUB = "1";

  const payload = (index) => ({
    email: `rate-${Date.now()}-${index}@example.invalid`,
    displayName: "限流测试",
    useCase: "测试内测申请接口的 IP 限流逻辑，需要足够长的说明文字。"
  });

  const statuses = [];
  for (let index = 1; index <= 6; index += 1) {
    const response = await app.inject({
      method: "POST",
      url: "/api/platform/beta/apply",
      payload: payload(index),
      remoteAddress: "203.0.113.10"
    });
    statuses.push(response.statusCode);
  }

  assert.ok(statuses.filter((code) => code === 201).length >= 1);
  assert.ok(statuses.includes(429), `expected 429 in ${statuses.join(",")}`);

  context.after(async () => {
    await query(`DELETE FROM beta_applications WHERE email LIKE 'rate-%@example.invalid'`);
  });
});
