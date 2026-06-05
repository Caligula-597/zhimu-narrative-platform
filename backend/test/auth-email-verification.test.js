import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { clearTestEmailCapture, peekTestVerifyUrl } from "../src/email.js";

const originalRequireVerify = process.env.REQUIRE_EMAIL_VERIFICATION;
const originalResendKey = process.env.RESEND_API_KEY;
const originalMailFrom = process.env.MAIL_FROM;
const originalAppUrl = process.env.APP_PUBLIC_URL;
const originalEmailProvider = process.env.EMAIL_PROVIDER;

function withVerificationEnv(fn) {
  process.env.REQUIRE_EMAIL_VERIFICATION = "true";
  process.env.EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.MAIL_FROM = "织幕测试 <test@example.invalid>";
  process.env.APP_PUBLIC_URL = "http://localhost:4173";
  process.env.EMAIL_DELIVERY_STUB = "1";
  return fn().finally(() => {
    clearTestEmailCapture();
    delete process.env.EMAIL_DELIVERY_STUB;
    if (originalRequireVerify === undefined) delete process.env.REQUIRE_EMAIL_VERIFICATION;
    else process.env.REQUIRE_EMAIL_VERIFICATION = originalRequireVerify;
    if (originalEmailProvider === undefined) delete process.env.EMAIL_PROVIDER;
    else process.env.EMAIL_PROVIDER = originalEmailProvider;
    if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendKey;
    if (originalMailFrom === undefined) delete process.env.MAIL_FROM;
    else process.env.MAIL_FROM = originalMailFrom;
    if (originalAppUrl === undefined) delete process.env.APP_PUBLIC_URL;
    else process.env.APP_PUBLIC_URL = originalAppUrl;
  });
}

test("GET /auth/config exposes verification policy", async (context) => {
  await withVerificationEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());
    const response = await app.inject({ method: "GET", url: "/api/auth/config" });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.requireEmailVerification, true);
    assert.equal(body.email.configured, true);
    assert.equal(body.email.provider, "resend");
  });
});

test("register with verification required sends email and blocks world create", async (context) => {
  await withVerificationEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());

    const email = `verify-flow-${Date.now()}@example.invalid`;
    const register = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { displayName: "验证测试", email, password: "pass-word-12345" }
    });
    assert.equal(register.statusCode, 201);
    const regBody = register.json();
    assert.equal(regBody.pendingEmailVerification, true);
    assert.equal(regBody.token, undefined);
    assert.equal(regBody.user.emailVerified, false);

    const verifyUrl = peekTestVerifyUrl();
    assert.ok(verifyUrl);
    const verifyToken = new URL(verifyUrl).searchParams.get("verify");

    const createWorld = await app.inject({
      method: "POST",
      url: "/api/worlds",
      headers: { authorization: `Bearer ${regBody.token || "missing"}` },
      payload: { name: "未验证世界" }
    });
    assert.equal(createWorld.statusCode, 401);

    const verify = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: { token: verifyToken }
    });
    assert.equal(verify.statusCode, 200);
    assert.ok(verify.json().token);
    assert.equal(verify.json().user.emailVerified, true);

    const createAfter = await app.inject({
      method: "POST",
      url: "/api/worlds",
      headers: { authorization: `Bearer ${verify.json().token}` },
      payload: { name: "已验证世界" }
    });
    assert.equal(createAfter.statusCode, 201);
  });
});

test("verify-email rejects reused token", async (context) => {
  await withVerificationEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());

    const email = `verify-once-${Date.now()}@example.invalid`;
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { displayName: "单次验证", email, password: "pass-word-12345" }
    });
    const verifyToken = new URL(peekTestVerifyUrl()).searchParams.get("verify");

    const first = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: { token: verifyToken }
    });
    assert.equal(first.statusCode, 200);

    const second = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: { token: verifyToken }
    });
    assert.equal(second.statusCode, 400);
    assert.equal(second.json().code, "EMAIL_VERIFICATION_INVALID");
  });
});

test("resend-verification requires authenticated session", async (context) => {
  await withVerificationEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());

    const email = `resend-${Date.now()}@example.invalid`;
    const register = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { displayName: "重发测试", email, password: "pass-word-12345" }
    });
    assert.equal(register.statusCode, 201);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "pass-word-12345" }
    });
    assert.equal(login.statusCode, 200);
    const { token } = login.json();

    clearTestEmailCapture();
    const resend = await app.inject({
      method: "POST",
      url: "/api/auth/resend-verification",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(resend.statusCode, 200);
    assert.ok(peekTestVerifyUrl());
  });
});
