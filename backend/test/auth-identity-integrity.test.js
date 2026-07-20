import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { hashClientIp } from "../src/auth.js";
import { normalizeIdentityWriteError } from "../src/auth-identity-errors.js";
import { loginIdentity } from "../src/auth-session-service.js";
import { registerIdentity } from "../src/auth-registration-service.js";
import { transaction, query } from "../src/db.js";
import {
  clearTestEmailCapture,
  clearTestResetCapture,
  peekTestResetUrl,
  peekTestVerifyUrl
} from "../src/email.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const ENV_KEYS = [
  "REQUIRE_EMAIL_VERIFICATION",
  "EMAIL_PROVIDER",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "APP_PUBLIC_URL",
  "EMAIL_DELIVERY_STUB",
  "PASSWORD_RESET_EMAIL_STUB",
  "REGISTER_IP_DAY_MAX",
  "GUEST_CREATE_HOUR_MAX",
  "GUEST_CREATE_DAY_MAX"
];

async function withIdentityEnvironment({
  requireVerification = false,
  registerMax = "0",
  guestHourMax = "1000",
  guestDayMax = "1000"
} = {}, work) {
  const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.REQUIRE_EMAIL_VERIFICATION = requireVerification ? "true" : "false";
  process.env.EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.MAIL_FROM = "Zhimu Test <test@example.invalid>";
  process.env.APP_PUBLIC_URL = "http://localhost:4173";
  process.env.EMAIL_DELIVERY_STUB = "1";
  process.env.PASSWORD_RESET_EMAIL_STUB = "1";
  process.env.REGISTER_IP_DAY_MAX = registerMax;
  process.env.GUEST_CREATE_HOUR_MAX = guestHourMax;
  process.env.GUEST_CREATE_DAY_MAX = guestDayMax;
  try {
    return await work();
  } finally {
    clearTestEmailCapture();
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

async function createWorldInvite(app, email) {
  const created = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Identity invite ${Date.now()}` }
  });
  assert.equal(created.statusCode, 201, created.body);
  const worldId = created.json().id;
  const invited = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/members`,
    headers: { "x-user-id": hostUserId },
    payload: { email, role: "editor" }
  });
  assert.equal(invited.statusCode, 201, invited.body);
  return worldId;
}

test("identity writes map conflicts, lock pressure and timeouts to stable contracts", () => {
  const duplicate = normalizeIdentityWriteError({ code: "23505", constraint: "users_email_key" });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.code, "EMAIL_ALREADY_REGISTERED");
  const busy = normalizeIdentityWriteError({ code: "55P03" });
  assert.equal(busy.statusCode, 409);
  assert.equal(busy.code, "IDENTITY_WRITE_BUSY");
  const timeout = normalizeIdentityWriteError({ code: "57014" });
  assert.equal(timeout.statusCode, 503);
  assert.equal(timeout.code, "IDENTITY_WRITE_TIMEOUT");
});

test("registration foundation rolls back with the user when a downstream write fails", async (context) => {
  await withIdentityEnvironment({}, async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());
    const email = `identity-rollback-${Date.now()}@example.invalid`;
    const remoteAddress = "10.77.1.10";
    const ipHash = hashClientIp(remoteAddress);

    await query(`
      CREATE OR REPLACE FUNCTION test_fail_identity_quota_insert()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced identity quota failure';
      END $$`);
    await query(`
      CREATE TRIGGER test_fail_identity_quota_insert_trigger
      BEFORE INSERT ON storage_quotas
      FOR EACH STATEMENT EXECUTE FUNCTION test_fail_identity_quota_insert()`);
    context.after(async () => {
      await query(`DROP TRIGGER IF EXISTS test_fail_identity_quota_insert_trigger ON storage_quotas`);
      await query(`DROP FUNCTION IF EXISTS test_fail_identity_quota_insert()`);
    });

    const failed = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      remoteAddress,
      payload: { email, displayName: "Atomic Register", password: "atomic-pass-12345" }
    });
    assert.equal(failed.statusCode, 500);
    assert.equal((await query(`SELECT 1 FROM users WHERE email = $1`, [email])).rowCount, 0);
    assert.equal((await query(
      `SELECT 1 FROM auth_account_creation_events WHERE ip_hash = $1`,
      [ipHash]
    )).rowCount, 0);

    await query(`DROP TRIGGER test_fail_identity_quota_insert_trigger ON storage_quotas`);
    await query(`DROP FUNCTION test_fail_identity_quota_insert()`);
    const retry = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      remoteAddress,
      payload: { email, displayName: "Atomic Register", password: "atomic-pass-12345" }
    });
    assert.equal(retry.statusCode, 201, retry.body);
  });
});

test("concurrent registration creates one complete identity and one typed conflict", async (context) => {
  await withIdentityEnvironment({}, async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());
    const email = `identity-race-${Date.now()}@example.invalid`;
    const responses = await Promise.all([
      app.inject({
        method: "POST",
        url: "/api/auth/register",
        remoteAddress: "10.77.2.10",
        payload: { email, displayName: "Race A", password: "race-pass-a-12345" }
      }),
      app.inject({
        method: "POST",
        url: "/api/auth/register",
        remoteAddress: "10.77.2.11",
        payload: { email, displayName: "Race B", password: "race-pass-b-12345" }
      })
    ]);
    assert.deepEqual(
      responses.map((response) => response.statusCode).sort((a, b) => a - b),
      [201, 409]
    );
    assert.equal(responses.find((response) => response.statusCode === 409).json().code, "EMAIL_ALREADY_REGISTERED");
    const foundation = await query(
      `SELECT users.id,
              (SELECT COUNT(*)::int FROM user_plans WHERE user_id = users.id) AS plans,
              (SELECT COUNT(*)::int FROM storage_quotas WHERE user_id = users.id) AS quotas
       FROM users WHERE email = $1`,
      [email]
    );
    assert.equal(foundation.rowCount, 1);
    assert.equal(foundation.rows[0].plans, 1);
    assert.equal(foundation.rows[0].quotas, 1);
  });
});

test("database registration cap remains atomic when verification creates no session", async (context) => {
  await withIdentityEnvironment({ requireVerification: true, registerMax: "1" }, async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());
    const remoteAddress = "10.77.3.10";
    const responses = await Promise.all(["a", "b"].map((suffix) => app.inject({
      method: "POST",
      url: "/api/auth/register",
      remoteAddress,
      payload: {
        email: `identity-cap-${suffix}-${Date.now()}@example.invalid`,
        displayName: `Cap ${suffix}`,
        password: "cap-pass-12345"
      }
    })));
    assert.deepEqual(
      responses.map((response) => response.statusCode).sort((a, b) => a - b),
      [201, 429]
    );
    assert.equal(responses.find((response) => response.statusCode === 429).json().code, "REGISTER_IP_RATE_LIMITED");
    const events = await query(
      `SELECT COUNT(*)::int AS count
       FROM auth_account_creation_events
       WHERE ip_hash = $1 AND account_kind = 'registered'`,
      [hashClientIp(remoteAddress)]
    );
    assert.equal(events.rows[0].count, 1);
  });
});

test("guest creation cap is atomic under concurrent requests", async (context) => {
  await withIdentityEnvironment({ guestHourMax: "1", guestDayMax: "1" }, async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());
    const responses = await Promise.all(["A", "B"].map((suffix) => app.inject({
      method: "POST",
      url: "/api/auth/guest",
      remoteAddress: "10.77.4.10",
      payload: { displayName: `Guest ${suffix}` }
    })));
    assert.deepEqual(
      responses.map((response) => response.statusCode).sort((a, b) => a - b),
      [201, 429]
    );
    assert.equal(responses.find((response) => response.statusCode === 429).json().code, "GUEST_CREATE_RATE_LIMITED");
  });
});

test("email ownership gates automatic invite acceptance until verification", async (context) => {
  await withIdentityEnvironment({ requireVerification: true }, async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: true });
    context.after(() => app.close());
    const email = `verified-invite-${Date.now()}@example.invalid`;
    const worldId = await createWorldInvite(app, email);
    clearTestEmailCapture();

    const registered = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, displayName: "Verified Invite", password: "invite-pass-12345" }
    });
    assert.equal(registered.statusCode, 201, registered.body);
    assert.equal(registered.json().pendingEmailVerification, true);
    assert.deepEqual(registered.json().acceptedInvites, []);
    assert.equal((await query(
      `SELECT 1 FROM world_members member
       JOIN users ON users.id = member.user_id
       WHERE member.world_id = $1 AND users.email = $2`,
      [worldId, email]
    )).rowCount, 0);

    const verifyToken = new URL(peekTestVerifyUrl()).searchParams.get("verify");
    const verified = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: { token: verifyToken }
    });
    assert.equal(verified.statusCode, 200, verified.body);
    assert.equal(verified.json().acceptedInvites.length, 1);
    assert.equal((await query(
      `SELECT 1 FROM world_members member
       JOIN users ON users.id = member.user_id
       WHERE member.world_id = $1 AND users.email = $2`,
      [worldId, email]
    )).rowCount, 1);
  });
});

test("guest upgrade cannot claim invited email before verification", async (context) => {
  await withIdentityEnvironment({ requireVerification: true }, async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: true });
    context.after(() => app.close());
    const email = `upgrade-invite-${Date.now()}@example.invalid`;
    const worldId = await createWorldInvite(app, email);
    const guest = await app.inject({
      method: "POST",
      url: "/api/auth/guest",
      remoteAddress: "10.77.5.10",
      payload: { displayName: "Upgrade Guest" }
    });
    assert.equal(guest.statusCode, 201, guest.body);
    clearTestEmailCapture();

    const upgraded = await app.inject({
      method: "POST",
      url: "/api/auth/upgrade",
      remoteAddress: "10.77.5.10",
      headers: { authorization: `Bearer ${guest.json().token}` },
      payload: { email, displayName: "Upgraded User", password: "upgrade-pass-12345" }
    });
    assert.equal(upgraded.statusCode, 200, upgraded.body);
    assert.equal(upgraded.json().pendingEmailVerification, true);
    assert.equal(upgraded.json().user.emailVerified, false);
    assert.deepEqual(upgraded.json().acceptedInvites, []);
    assert.equal((await query(
      `SELECT 1 FROM world_members member
       JOIN users ON users.id = member.user_id
       WHERE member.world_id = $1 AND users.email = $2`,
      [worldId, email]
    )).rowCount, 0);

    const verifyToken = new URL(peekTestVerifyUrl()).searchParams.get("verify");
    const verified = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: { token: verifyToken }
    });
    assert.equal(verified.statusCode, 200, verified.body);
    assert.equal(verified.json().acceptedInvites.length, 1);
  });
});

test("verification delivery failure still returns a complete recoverable registration", async (context) => {
  await withIdentityEnvironment({ requireVerification: true }, async () => {
    const email = `identity-mail-failure-${Date.now()}@example.invalid`;
    const result = await registerIdentity({
      body: { email, displayName: "Mail Failure", password: "mail-failure-pass-12345" },
      ip: "10.77.6.10",
      sessionMeta: {},
      logger: { error() {} },
      sendVerificationEmail: async () => {
        throw Object.assign(new Error("ambiguous provider timeout"), { code: "UPSTREAM_ERROR" });
      }
    });
    assert.equal(result.pendingEmailVerification, true);
    assert.equal(result.verificationEmailSent, false);
    assert.equal(result.session, null);
    const state = await query(
      `SELECT users.id,
              (SELECT COUNT(*)::int FROM user_plans WHERE user_id = users.id) AS plans,
              (SELECT COUNT(*)::int FROM storage_quotas WHERE user_id = users.id) AS quotas,
              (SELECT COUNT(*)::int FROM email_verification_tokens
               WHERE user_id = users.id AND used_at IS NULL AND expires_at > now()) AS tokens
       FROM users WHERE email = $1`,
      [email]
    );
    assert.equal(state.rowCount, 1);
    assert.equal(state.rows[0].plans, 1);
    assert.equal(state.rows[0].quotas, 1);
    assert.equal(state.rows[0].tokens, 1);
  });
});

test("password reset racing a login prevents an old password from creating a new session", async (context) => {
  await withIdentityEnvironment({}, async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: false });
    context.after(() => app.close());
    const email = `login-reset-race-${Date.now()}@example.invalid`;
    const oldPassword = "login-race-old-12345";
    const newPassword = "login-race-new-12345";
    const registered = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, displayName: "Login Reset Race", password: oldPassword }
    });
    assert.equal(registered.statusCode, 201, registered.body);
    clearTestResetCapture();
    const forgot = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email }
    });
    assert.equal(forgot.statusCode, 200);
    const resetToken = new URL(peekTestResetUrl()).searchParams.get("reset");

    let releaseTransaction;
    let signalTransaction;
    const transactionEntered = new Promise((resolve) => { signalTransaction = resolve; });
    const transactionGate = new Promise((resolve) => { releaseTransaction = resolve; });
    const staleLogin = loginIdentity({
      email,
      password: oldPassword,
      sessionMeta: { deviceLabel: "stale-login" },
      transactionRunner: async (work) => {
        signalTransaction();
        await transactionGate;
        return transaction(work);
      }
    });
    await transactionEntered;

    try {
      const reset = await app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        payload: { token: resetToken, password: newPassword }
      });
      assert.equal(reset.statusCode, 200, reset.body);
    } finally {
      releaseTransaction();
    }
    await assert.rejects(staleLogin, (error) => {
      assert.equal(error.code, "INVALID_CREDENTIALS");
      return true;
    });

    const staleSessions = await query(
      `SELECT COUNT(*)::int AS count
       FROM auth_sessions session
       JOIN users ON users.id = session.user_id
       WHERE users.email = $1 AND session.device_label = 'stale-login'`,
      [email]
    );
    assert.equal(staleSessions.rows[0].count, 0);
    const newLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: newPassword }
    });
    assert.equal(newLogin.statusCode, 200, newLogin.body);
  });
});
