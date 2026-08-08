import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import {
  deliverVerificationChallenge,
  existingRegistrationErrorCode
} from "../src/auth-registration-service.js";
import {
  clearTestEmailCapture,
  peekTestVerificationCode,
  peekTestVerifyUrl
} from "../src/email.js";
import { query } from "../src/db.js";

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

function sessionCookieFrom(response) {
  const header = String(response.headers["set-cookie"] || "");
  assert.match(header, /zhimu_session=/u);
  return header.split(";", 1)[0];
}

test("GET /auth/config exposes verification policy without provider details", async (context) => {
  await withVerificationEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());
    const response = await app.inject({ method: "GET", url: "/api/auth/config" });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.requireEmailVerification, true);
    assert.equal(body.email.configured, true);
    assert.equal(body.email.provider, undefined);
    assert.equal(body.email.from, undefined);
  });
});

test("registration returns a pending state before a slow email provider can outlive the frontend request", async () => {
  const logged = [];
  const startedAt = Date.now();
  const delivered = await deliverVerificationChallenge({
    user: { id: "slow-email-user", email: "slow@example.invalid" },
    challenge: { token: "slow-token" },
    deliveryWaitMs: 10,
    logger: { error: (entry, message) => logged.push({ entry, message }) },
    sendVerificationEmail: () => new Promise(() => {})
  });

  assert.equal(delivered, false);
  assert.ok(Date.now() - startedAt < 500);
  assert.equal(logged.length, 1);
  assert.equal(logged[0].entry.err.code, "EMAIL_DELIVERY_TIMEOUT");
});

test("registration conflicts distinguish verified accounts from pending verification", () => {
  assert.equal(existingRegistrationErrorCode(null), null);
  assert.equal(
    existingRegistrationErrorCode({ email_verified_at: null }),
    "EMAIL_VERIFICATION_PENDING"
  );
  assert.equal(
    existingRegistrationErrorCode({ email_verified_at: "2026-07-27T00:00:00.000Z" }),
    "EMAIL_ALREADY_REGISTERED"
  );
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
    assert.match(regBody.verificationChallenge.id, /^[0-9a-f-]{36}$/i);
    assert.equal(regBody.verificationChallenge.codeLength, 6);
    assert.equal("code" in regBody.verificationChallenge, false);

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

test("six-digit code verifies once, creates a session and rejects reuse", async (context) => {
  await withVerificationEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());

    const email = `verify-code-${Date.now()}@example.invalid`;
    const register = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { displayName: "验证码测试", email, password: "pass-word-12345" }
    });
    assert.equal(register.statusCode, 201, register.body);
    const challengeId = register.json().verificationChallenge.id;
    const code = peekTestVerificationCode();
    assert.match(code, /^\d{6}$/);

    const verify = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email-code",
      payload: { challengeId, code }
    });
    assert.equal(verify.statusCode, 200, verify.body);
    assert.ok(verify.json().token);
    assert.equal(verify.json().user.emailVerified, true);

    const reuse = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email-code",
      payload: { challengeId, code }
    });
    assert.equal(reuse.statusCode, 400, reuse.body);
    assert.equal(reuse.json().code, "EMAIL_VERIFICATION_CODE_INVALID");
  });
});

test("code resend enforces cooldown, rotates credentials and invalidates the old code", async (context) => {
  await withVerificationEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());

    const email = `verify-resend-code-${Date.now()}@example.invalid`;
    const register = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { displayName: "验证码重发", email, password: "pass-word-12345" }
    });
    assert.equal(register.statusCode, 201, register.body);
    const challengeId = register.json().verificationChallenge.id;
    const firstCode = peekTestVerificationCode();

    const early = await app.inject({
      method: "POST",
      url: "/api/auth/resend-verification-code",
      payload: { challengeId }
    });
    assert.equal(early.statusCode, 429, early.body);
    assert.equal(early.json().code, "EMAIL_VERIFICATION_RESEND_COOLDOWN");

    await query(
      `UPDATE email_verification_tokens
       SET last_sent_at = now() - interval '61 seconds'
       WHERE challenge_id = $1`,
      [challengeId]
    );
    clearTestEmailCapture();
    const resent = await app.inject({
      method: "POST",
      url: "/api/auth/resend-verification-code",
      payload: { challengeId }
    });
    assert.equal(resent.statusCode, 200, resent.body);
    const secondCode = peekTestVerificationCode();
    assert.match(secondCode, /^\d{6}$/);
    assert.equal(resent.json().verificationChallenge.id, challengeId);

    const oldCode = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email-code",
      payload: { challengeId, code: firstCode }
    });
    assert.equal(oldCode.statusCode, 400, oldCode.body);

    const currentCode = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email-code",
      payload: { challengeId, code: secondCode }
    });
    assert.equal(currentCode.statusCode, 200, currentCode.body);
  });
});

test("registering an existing unverified email returns a pending-verification state", async (context) => {
  await withVerificationEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());

    const email = `verify-pending-${Date.now()}@example.invalid`;
    const payload = { displayName: "待验证账号", email, password: "pass-word-12345" };
    const first = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload
    });
    assert.equal(first.statusCode, 201, first.body);
    assert.equal(first.json().pendingEmailVerification, true);

    const second = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload
    });
    assert.equal(second.statusCode, 409, second.body);
    assert.equal(second.json().code, "EMAIL_VERIFICATION_PENDING");
  });
});

test("unverified password login returns a challenge without issuing a session", async (context) => {
  await withVerificationEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());

    const email = `verify-login-${Date.now()}@example.invalid`;
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { displayName: "待验证登录", email, password: "pass-word-12345" }
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "pass-word-12345" }
    });
    assert.equal(login.statusCode, 200, login.body);
    assert.equal(login.json().pendingEmailVerification, true);
    assert.ok(login.json().verificationChallenge?.id);
    assert.equal(login.json().token, undefined);
    assert.equal(login.headers["set-cookie"], undefined);
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
    const sessionCookie = sessionCookieFrom(login);
    assert.equal(login.json().token, undefined);

    clearTestEmailCapture();
    const resend = await app.inject({
      method: "POST",
      url: "/api/auth/resend-verification",
      headers: { cookie: sessionCookie }
    });
    assert.equal(resend.statusCode, 200);
    assert.ok(peekTestVerifyUrl());
  });
});
