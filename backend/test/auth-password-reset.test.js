import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { clearTestResetCapture, peekTestResetUrl } from "../src/email.js";

const originalResendKey = process.env.RESEND_API_KEY;
const originalMailFrom = process.env.MAIL_FROM;
const originalAppUrl = process.env.APP_PUBLIC_URL;

function withResendEnv(fn) {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.MAIL_FROM = "织幕测试 <test@example.invalid>";
  process.env.APP_PUBLIC_URL = "http://localhost:4173";
  process.env.PASSWORD_RESET_EMAIL_STUB = "1";
  return fn().finally(() => {
    clearTestResetCapture();
    delete process.env.PASSWORD_RESET_EMAIL_STUB;
    if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendKey;
    if (originalMailFrom === undefined) delete process.env.MAIL_FROM;
    else process.env.MAIL_FROM = originalMailFrom;
    if (originalAppUrl === undefined) delete process.env.APP_PUBLIC_URL;
    else process.env.APP_PUBLIC_URL = originalAppUrl;
  });
}

test("forgot-password returns 503 when email is not configured", async (context) => {
  const savedKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  context.after(() => {
    if (savedKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = savedKey;
  });

  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/forgot-password",
    payload: { email: "nobody@example.invalid" }
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().code, "EMAIL_NOT_CONFIGURED");
});

test("forgot-password always acks for unknown email when configured", async (context) => {
  await withResendEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: `missing-${Date.now()}@example.invalid` }
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().ok, true);
    assert.equal(peekTestResetUrl(), null);
  });
});

test("password reset flow updates password and invalidates old sessions", async (context) => {
  await withResendEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());

    const email = `reset-flow-${Date.now()}@example.invalid`;
    const password = "old-pass-12345";
    const newPassword = "new-pass-67890";

    const register = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { displayName: "重置测试", email, password }
    });
    assert.equal(register.statusCode, 201);
    const { token: oldSessionToken } = register.json();

    const forgot = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email }
    });
    assert.equal(forgot.statusCode, 200);

    const resetUrl = peekTestResetUrl();
    assert.match(resetUrl, /^http:\/\/localhost:4173\/\?reset=/);
    const resetToken = new URL(resetUrl).searchParams.get("reset");
    assert.ok(resetToken);

    const reset = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token: resetToken, password: newPassword }
    });
    assert.equal(reset.statusCode, 200);
    assert.equal(reset.json().ok, true);

    const oldMe = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${oldSessionToken}` }
    });
    assert.equal(oldMe.statusCode, 401);

    const oldLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password }
    });
    assert.equal(oldLogin.statusCode, 401);

    const newLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: newPassword }
    });
    assert.equal(newLogin.statusCode, 200);
    assert.ok(newLogin.json().token);
  });
});

test("reset-password rejects reused token", async (context) => {
  await withResendEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());

    const email = `reset-once-${Date.now()}@example.invalid`;
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { displayName: "单次重置", email, password: "first-pass-12345" }
    });
    await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email }
    });
    const resetToken = new URL(peekTestResetUrl()).searchParams.get("reset");

    const first = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token: resetToken, password: "second-pass-12345" }
    });
    assert.equal(first.statusCode, 200);

    const second = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token: resetToken, password: "third-pass-12345" }
    });
    assert.equal(second.statusCode, 400);
    assert.equal(second.json().code, "PASSWORD_RESET_INVALID");
  });
});
