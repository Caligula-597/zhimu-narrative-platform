import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { clearTestEmailCapture, peekTestVerificationCode } from "../src/email.js";
import { query } from "../src/db.js";

const trackedEnv = [
  "OPS_API_TOKEN",
  "REQUIRE_EMAIL_VERIFICATION",
  "EMAIL_PROVIDER",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "APP_PUBLIC_URL",
  "EMAIL_DELIVERY_STUB"
];

function configureVerificationOps() {
  const previous = Object.fromEntries(trackedEnv.map((key) => [key, process.env[key]]));
  process.env.OPS_API_TOKEN = "ops-user-management-test-token";
  process.env.REQUIRE_EMAIL_VERIFICATION = "true";
  process.env.EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.MAIL_FROM = "织幕测试 <test@example.invalid>";
  process.env.APP_PUBLIC_URL = "http://localhost:4173";
  process.env.EMAIL_DELIVERY_STUB = "1";
  return () => {
    clearTestEmailCapture();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function opsHeaders() {
  return { "x-ops-token": process.env.OPS_API_TOKEN };
}

test("OPS can search and reset an unverified registration so the email can register again", async (context) => {
  const restoreEnv = configureVerificationOps();
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  const email = `ops-reset-${Date.now()}@example.invalid`;
  context.after(async () => {
    await query(`DELETE FROM users WHERE lower(email) = $1`, [email]);
    await query(`DELETE FROM ops_user_audit_log WHERE lower(target_email) = $1`, [email]);
    await app.close();
    restoreEnv();
  });

  const registered = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { displayName: "待重置测试账号", email, password: "pass-word-12345" }
  });
  assert.equal(registered.statusCode, 201, registered.body);
  assert.equal(registered.json().pendingEmailVerification, true);
  const userId = registered.json().user.id;

  const denied = await app.inject({
    method: "GET",
    url: `/api/ops/users?search=${encodeURIComponent(email)}`
  });
  assert.equal(denied.statusCode, 401);

  const listed = await app.inject({
    method: "GET",
    url: `/api/ops/users?search=${encodeURIComponent(email)}&verification=pending`,
    headers: opsHeaders()
  });
  assert.equal(listed.statusCode, 200, listed.body);
  assert.equal(listed.json().total, 1);
  assert.equal(listed.json().items[0].id, userId);
  assert.equal(listed.json().items[0].verificationStatus, "pending");
  assert.equal(listed.json().items[0].hasActiveVerification, true);

  const preview = await app.inject({
    method: "GET",
    url: `/api/ops/users/${userId}/delete-preview`,
    headers: opsHeaders()
  });
  assert.equal(preview.statusCode, 200, preview.body);
  assert.equal(preview.json().canResetRegistration, true);
  assert.equal(preview.json().target.email, email);

  const wrongConfirmation = await app.inject({
    method: "POST",
    url: `/api/ops/users/${userId}/delete`,
    headers: opsHeaders(),
    payload: {
      confirmationEmail: "wrong@example.invalid",
      acknowledged: true,
      mode: "pending_reset"
    }
  });
  assert.equal(wrongConfirmation.statusCode, 400);
  assert.equal(wrongConfirmation.json().code, "ACCOUNT_DELETE_CONFIRMATION_INVALID");

  const reset = await app.inject({
    method: "POST",
    url: `/api/ops/users/${userId}/delete`,
    headers: opsHeaders(),
    payload: {
      confirmationEmail: email,
      acknowledged: true,
      mode: "pending_reset"
    }
  });
  assert.equal(reset.statusCode, 200, reset.body);
  assert.equal(reset.json().mode, "pending_reset");

  const [userRow, verificationRows, auditRows] = await Promise.all([
    query(`SELECT id FROM users WHERE id = $1`, [userId]),
    query(`SELECT id FROM email_verification_tokens WHERE user_id = $1`, [userId]),
    query(
      `SELECT action FROM ops_user_audit_log
       WHERE lower(target_email) = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    )
  ]);
  assert.equal(userRow.rowCount, 0);
  assert.equal(verificationRows.rowCount, 0);
  assert.equal(auditRows.rows[0]?.action, "user.pending_registration_reset");

  const registeredAgain = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { displayName: "重新注册测试账号", email, password: "pass-word-12345" }
  });
  assert.equal(registeredAgain.statusCode, 201, registeredAgain.body);
  assert.equal(registeredAgain.json().pendingEmailVerification, true);
});

test("OPS pending reset refuses a verified account but explicit account deletion succeeds", async (context) => {
  const restoreEnv = configureVerificationOps();
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  const email = `ops-delete-verified-${Date.now()}@example.invalid`;
  context.after(async () => {
    await query(`DELETE FROM users WHERE lower(email) = $1`, [email]);
    await query(`DELETE FROM ops_user_audit_log WHERE lower(target_email) = $1`, [email]);
    await app.close();
    restoreEnv();
  });

  const registered = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { displayName: "已验证删除测试", email, password: "pass-word-12345" }
  });
  assert.equal(registered.statusCode, 201, registered.body);
  const userId = registered.json().user.id;
  const code = peekTestVerificationCode();
  const verified = await app.inject({
    method: "POST",
    url: "/api/auth/verify-email-code",
    payload: {
      challengeId: registered.json().verificationChallenge.id,
      code
    }
  });
  assert.equal(verified.statusCode, 200, verified.body);

  const rejectedReset = await app.inject({
    method: "POST",
    url: `/api/ops/users/${userId}/delete`,
    headers: opsHeaders(),
    payload: {
      confirmationEmail: email,
      acknowledged: true,
      mode: "pending_reset"
    }
  });
  assert.equal(rejectedReset.statusCode, 403);
  assert.equal(rejectedReset.json().code, "ACCOUNT_DELETE_BLOCKED");

  const deleted = await app.inject({
    method: "POST",
    url: `/api/ops/users/${userId}/delete`,
    headers: opsHeaders(),
    payload: {
      confirmationEmail: email,
      acknowledged: true,
      mode: "account_delete"
    }
  });
  assert.equal(deleted.statusCode, 200, deleted.body);
  assert.equal(deleted.json().mode, "account_delete");

  const userRow = await query(`SELECT id FROM users WHERE id = $1`, [userId]);
  assert.equal(userRow.rowCount, 0);
});
