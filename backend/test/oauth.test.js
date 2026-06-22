import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { listEnabledOAuthProviders } from "../src/oauth-providers.js";

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

test("auth config exposes oauth provider list", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/api/auth/config" });
  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.json().oauth));
  assert.equal(response.json().oauthDiagnostics, undefined);
  if (listEnabledOAuthProviders().length) {
    assert.ok(response.json().oauth.length >= 1);
  }
});

test("oauth start returns 503 when provider is not configured", async (context) => {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    context.skip("Google OAuth configured in environment");
    return;
  }
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/api/auth/oauth/google/start" });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().code, "OAUTH_PROVIDER_DISABLED");
});

test("oauth complete exchanges one-time login code for session", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const email = `oauth-complete-${Date.now()}@zhimu.local`;
  const registered = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, displayName: "OAuth Complete", password: "oauth-pass-123" }
  });
  assert.equal(registered.statusCode, 201);
  const userId = registered.json().user.id;

  const code = randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO oauth_login_codes (code_hash, user_id, expires_at)
     VALUES ($1, $2, now() + interval '2 minutes')`,
    [hash(code), userId]
  );

  context.after(async () => {
    await query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  const complete = await app.inject({
    method: "POST",
    url: "/api/auth/oauth/complete",
    payload: { code }
  });
  assert.equal(complete.statusCode, 200, complete.body);
  assert.ok(complete.json().token);
  assert.equal(complete.json().user.email, email);

  const reused = await app.inject({
    method: "POST",
    url: "/api/auth/oauth/complete",
    payload: { code }
  });
  assert.equal(reused.statusCode, 400);
  assert.equal(reused.json().code, "OAUTH_LOGIN_CODE_INVALID");
});

test("resolveOAuthUser bootstraps plan and storage after commit for new google account", async (context) => {
  const { resolveOAuthUserForTests } = await import("../src/oauth-service.js");
  const email = `oauth-new-${Date.now()}@example.com`;
  const providerUserId = `google-sub-${Date.now()}`;

  const userId = await resolveOAuthUserForTests("google", {
    providerUserId,
    email,
    displayName: "New Google User",
    emailVerified: true,
    raw: { sub: providerUserId, email }
  });

  context.after(async () => {
    await query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  const plan = await query(`SELECT plan_code FROM user_plans WHERE user_id = $1`, [userId]);
  assert.equal(plan.rowCount, 1);
  assert.equal(plan.rows[0].plan_code, "free");

  const quota = await query(`SELECT user_id FROM storage_quotas WHERE user_id = $1`, [userId]);
  assert.equal(quota.rowCount, 1);

  const oauth = await query(
    `SELECT user_id FROM oauth_accounts WHERE provider = 'google' AND provider_user_id = $1`,
    [providerUserId]
  );
  assert.equal(oauth.rows[0].user_id, userId);
});
