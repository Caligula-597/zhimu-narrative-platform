import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import {
  normalizeAuthRecoveryError,
  requestPasswordReset
} from "../src/auth-recovery-service.js";
import { hashAuthToken } from "../src/auth-token.js";
import { query } from "../src/db.js";
import {
  clearTestEmailCapture,
  clearTestResetCapture,
  peekTestResetUrl,
  peekTestVerifyUrl
} from "../src/email.js";
import { resetRateLimitersForTests } from "../src/rate-limit.js";

const EMAIL_ENV_KEYS = [
  "REQUIRE_EMAIL_VERIFICATION",
  "EMAIL_PROVIDER",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "APP_PUBLIC_URL",
  "EMAIL_DELIVERY_STUB",
  "PASSWORD_RESET_EMAIL_STUB"
];

async function withEmailEnvironment({ requireVerification = false } = {}, work) {
  const original = Object.fromEntries(EMAIL_ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.REQUIRE_EMAIL_VERIFICATION = requireVerification ? "true" : "false";
  process.env.EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.MAIL_FROM = "Zhimu Test <test@example.invalid>";
  process.env.APP_PUBLIC_URL = "http://localhost:4173";
  process.env.EMAIL_DELIVERY_STUB = "1";
  process.env.PASSWORD_RESET_EMAIL_STUB = "1";
  try {
    return await work();
  } finally {
    clearTestEmailCapture();
    resetRateLimitersForTests();
    for (const key of EMAIL_ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

async function register(app, { email, password = "old-pass-12345", displayName = "Recovery Test" }) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, password, displayName }
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json();
}

async function requestResetToken(app, email) {
  clearTestResetCapture();
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/forgot-password",
    payload: { email }
  });
  assert.equal(response.statusCode, 200, response.body);
  const resetUrl = peekTestResetUrl();
  assert.ok(resetUrl);
  return new URL(resetUrl).searchParams.get("reset");
}

function sessionCookieFrom(response) {
  const header = String(response.headers["set-cookie"] || "");
  assert.match(header, /zhimu_session=/u);
  return header.split(";", 1)[0];
}

test("auth recovery maps lock and statement failures to stable retry contracts", () => {
  const busy = normalizeAuthRecoveryError({ code: "55P03" });
  assert.equal(busy.statusCode, 409);
  assert.equal(busy.code, "AUTH_RECOVERY_WRITE_BUSY");
  const timeout = normalizeAuthRecoveryError({ code: "57014" });
  assert.equal(timeout.statusCode, 503);
  assert.equal(timeout.code, "AUTH_RECOVERY_WRITE_TIMEOUT");
});

test("concurrent reset requests leave one active challenge and a reset token is single-use", async (context) => {
  await withEmailEnvironment({}, async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());
    const email = `reset-race-${Date.now()}@example.invalid`;
    await register(app, { email });

    const forgotResponses = await Promise.all([
      app.inject({ method: "POST", url: "/api/auth/forgot-password", payload: { email } }),
      app.inject({ method: "POST", url: "/api/auth/forgot-password", payload: { email } })
    ]);
    assert.deepEqual(forgotResponses.map((response) => response.statusCode), [200, 200]);
    const active = await query(
      `SELECT COUNT(*)::int AS count
       FROM password_reset_tokens token
       JOIN users ON users.id = token.user_id
       WHERE users.email = $1 AND token.used_at IS NULL`,
      [email]
    );
    assert.equal(active.rows[0].count, 1);

    const resetToken = new URL(peekTestResetUrl()).searchParams.get("reset");
    const responses = await Promise.all([
      app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        payload: { token: resetToken, password: "race-pass-a-12345" }
      }),
      app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        payload: { token: resetToken, password: "race-pass-b-12345" }
      })
    ]);
    assert.deepEqual(
      responses.map((response) => response.statusCode).sort((a, b) => a - b),
      [200, 400]
    );
    assert.equal(responses.find((response) => response.statusCode === 400).json().code, "PASSWORD_RESET_INVALID");
  });
});

test("password reset rolls token, password and session revocation back together", async (context) => {
  await withEmailEnvironment({}, async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());
    const email = `reset-rollback-${Date.now()}@example.invalid`;
    const registration = await register(app, { email });
    const resetToken = await requestResetToken(app, email);
    const tokenHash = hashAuthToken(resetToken);

    await query(`
      CREATE OR REPLACE FUNCTION test_fail_auth_session_delete()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced session delete failure';
      END $$`);
    await query(`
      CREATE TRIGGER test_fail_auth_session_delete_trigger
      BEFORE DELETE ON auth_sessions
      FOR EACH STATEMENT EXECUTE FUNCTION test_fail_auth_session_delete()`);
    context.after(async () => {
      await query(`DROP TRIGGER IF EXISTS test_fail_auth_session_delete_trigger ON auth_sessions`);
      await query(`DROP FUNCTION IF EXISTS test_fail_auth_session_delete()`);
    });

    const failed = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token: resetToken, password: "new-pass-rollback-12345" }
    });
    assert.equal(failed.statusCode, 500);
    const tokenState = await query(
      `SELECT used_at FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    assert.equal(tokenState.rows[0].used_at, null);
    const oldSession = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${registration.token}` }
    });
    assert.equal(oldSession.statusCode, 200);

    await query(`DROP TRIGGER test_fail_auth_session_delete_trigger ON auth_sessions`);
    await query(`DROP FUNCTION test_fail_auth_session_delete()`);
    const retry = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token: resetToken, password: "new-pass-rollback-12345" }
    });
    assert.equal(retry.statusCode, 200, retry.body);
  });
});

test("email verification rolls token, user state and session creation back together", async (context) => {
  await withEmailEnvironment({ requireVerification: true }, async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());
    const email = `verify-rollback-${Date.now()}@example.invalid`;
    await register(app, { email });
    const verifyToken = new URL(peekTestVerifyUrl()).searchParams.get("verify");
    const tokenHash = hashAuthToken(verifyToken);

    await query(`
      CREATE OR REPLACE FUNCTION test_fail_auth_session_insert()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced session insert failure';
      END $$`);
    await query(`
      CREATE TRIGGER test_fail_auth_session_insert_trigger
      BEFORE INSERT ON auth_sessions
      FOR EACH STATEMENT EXECUTE FUNCTION test_fail_auth_session_insert()`);
    context.after(async () => {
      await query(`DROP TRIGGER IF EXISTS test_fail_auth_session_insert_trigger ON auth_sessions`);
      await query(`DROP FUNCTION IF EXISTS test_fail_auth_session_insert()`);
    });

    const failed = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: { token: verifyToken }
    });
    assert.equal(failed.statusCode, 500);
    const state = await query(
      `SELECT token.used_at, users.email_verified_at
       FROM email_verification_tokens token
       JOIN users ON users.id = token.user_id
       WHERE token.token_hash = $1`,
      [tokenHash]
    );
    assert.equal(state.rows[0].used_at, null);
    assert.equal(state.rows[0].email_verified_at, null);

    await query(`DROP TRIGGER test_fail_auth_session_insert_trigger ON auth_sessions`);
    await query(`DROP FUNCTION test_fail_auth_session_insert()`);
    const retry = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: { token: verifyToken }
    });
    assert.equal(retry.statusCode, 200, retry.body);
  });
});

test("password reset provider failures keep the public outcome uniform and preserve ambiguous delivery", async (context) => {
  await withEmailEnvironment({}, async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());
    const email = `reset-provider-${Date.now()}@example.invalid`;
    await register(app, { email });
    let sends = 0;
    const failingSender = async () => {
      sends += 1;
      throw Object.assign(new Error("provider unavailable"), { code: "UPSTREAM_ERROR" });
    };
    const logger = { error() {} };

    const registered = await requestPasswordReset({ email, logger, sendEmail: failingSender });
    const unknown = await requestPasswordReset({
      email: `missing-${Date.now()}@example.invalid`,
      logger,
      sendEmail: failingSender
    });
    assert.deepEqual(registered, { delivered: false });
    assert.deepEqual(unknown, { delivered: false });
    assert.equal(sends, 1);
    const active = await query(
      `SELECT COUNT(*)::int AS count
       FROM password_reset_tokens token
       JOIN users ON users.id = token.user_id
       WHERE users.email = $1 AND token.used_at IS NULL`,
      [email]
    );
    assert.equal(active.rows[0].count, 1);
  });
});

test("concurrent email verification creates one session and rejects the replay", async (context) => {
  await withEmailEnvironment({ requireVerification: true }, async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());
    const email = `verify-race-${Date.now()}@example.invalid`;
    await register(app, { email });
    const verifyToken = new URL(peekTestVerifyUrl()).searchParams.get("verify");
    const responses = await Promise.all([
      app.inject({ method: "POST", url: "/api/auth/verify-email", payload: { token: verifyToken } }),
      app.inject({ method: "POST", url: "/api/auth/verify-email", payload: { token: verifyToken } })
    ]);
    assert.deepEqual(
      responses.map((response) => response.statusCode).sort((a, b) => a - b),
      [200, 400]
    );
    const sessions = await query(
      `SELECT COUNT(*)::int AS count
       FROM auth_sessions session
       JOIN users ON users.id = session.user_id
       WHERE users.email = $1 AND session.revoked_at IS NULL`,
      [email]
    );
    assert.equal(sessions.rows[0].count, 1);
  });
});

test("verification resend is limited independently per authenticated account", async (context) => {
  await withEmailEnvironment({ requireVerification: true }, async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false, rateLimit: true });
    context.after(() => app.close());
    const email = `verify-limit-${Date.now()}@example.invalid`;
    await register(app, { email });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "old-pass-12345" }
    });
    assert.equal(login.statusCode, 200, login.body);
    assert.equal(login.json().token, undefined);
    const headers = { cookie: sessionCookieFrom(login) };
    const responses = [];
    for (let index = 0; index < 4; index += 1) {
      responses.push(await app.inject({
        method: "POST",
        url: "/api/auth/resend-verification",
        headers
      }));
    }
    assert.deepEqual(responses.map((response) => response.statusCode), [200, 200, 200, 429]);
    assert.equal(responses[3].headers["ratelimit-limit"], "3");
  });
});
