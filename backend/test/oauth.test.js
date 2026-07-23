import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { createApp } from "../src/app.js";
import { query, transaction } from "../src/db.js";
import { listEnabledOAuthProviders } from "../src/oauth-providers.js";
import { resolveOAuthIdentity } from "../src/oauth-identity-service.js";

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
  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  const previousClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  context.after(() => {
    if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previousClientId;
    if (previousClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = previousClientSecret;
  });
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());
  const before = await query(`SELECT COUNT(*)::int AS count FROM oauth_states WHERE provider = 'google'`);
  const response = await app.inject({ method: "GET", url: "/api/auth/oauth/google/start" });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().code, "OAUTH_PROVIDER_DISABLED");
  const after = await query(`SELECT COUNT(*)::int AS count FROM oauth_states WHERE provider = 'google'`);
  assert.equal(after.rows[0].count, before.rows[0].count);
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

test("resolveOAuthUser atomically bootstraps plan and storage for new google account", async (context) => {
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

test("oauth identity creation rolls back user and provider link when foundation write fails", async (context) => {
  const email = `oauth-rollback-${Date.now()}@example.com`;
  const providerUserId = `google-rollback-${randomBytes(6).toString("hex")}`;

  await query(`
    CREATE OR REPLACE FUNCTION test_fail_oauth_quota_insert()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'forced oauth quota failure';
    END $$`);
  await query(`
    CREATE TRIGGER test_fail_oauth_quota_insert_trigger
    BEFORE INSERT ON storage_quotas
    FOR EACH STATEMENT EXECUTE FUNCTION test_fail_oauth_quota_insert()`);
  context.after(async () => {
    await query(`DROP TRIGGER IF EXISTS test_fail_oauth_quota_insert_trigger ON storage_quotas`);
    await query(`DROP FUNCTION IF EXISTS test_fail_oauth_quota_insert()`);
    await query(`DELETE FROM users WHERE email = $1`, [email]);
  });

  await assert.rejects(
    resolveOAuthIdentity({
      providerId: "google",
      profile: {
        providerUserId,
        email,
        displayName: "OAuth Rollback",
        emailVerified: true,
        raw: { sub: providerUserId, email }
      }
    }),
    /forced oauth quota failure/
  );
  assert.equal((await query(`SELECT 1 FROM users WHERE email = $1`, [email])).rowCount, 0);
  assert.equal((await query(
    `SELECT 1 FROM oauth_accounts WHERE provider = 'google' AND provider_user_id = $1`,
    [providerUserId]
  )).rowCount, 0);
});

test("concurrent oauth callbacks keep one complete provider identity", async (context) => {
  const email = `oauth-race-${Date.now()}@example.com`;
  const providerUserId = `google-race-${randomBytes(6).toString("hex")}`;
  const profile = {
    providerUserId,
    email,
    displayName: "OAuth Race",
    emailVerified: true,
    raw: { sub: providerUserId, email }
  };

  const resolved = await Promise.all([
    resolveOAuthIdentity({ providerId: "google", profile }),
    resolveOAuthIdentity({ providerId: "google", profile })
  ]);
  const userId = resolved[0].user.id;
  context.after(async () => query(`DELETE FROM users WHERE id = $1`, [userId]));

  assert.equal(resolved[1].user.id, userId);
  const state = await query(
    `SELECT users.id,
            (SELECT COUNT(*)::int FROM oauth_accounts WHERE user_id = users.id) AS oauth_links,
            (SELECT COUNT(*)::int FROM user_plans WHERE user_id = users.id) AS plans,
            (SELECT COUNT(*)::int FROM storage_quotas WHERE user_id = users.id) AS quotas
     FROM users WHERE email = $1`,
    [email]
  );
  assert.equal(state.rowCount, 1);
  assert.equal(state.rows[0].oauth_links, 1);
  assert.equal(state.rows[0].plans, 1);
  assert.equal(state.rows[0].quotas, 1);
});

test("new oauth identity and login code stay within the SQL round-trip budget", async (context) => {
  const email = `oauth-query-budget-${Date.now()}@example.com`;
  const providerUserId = `google-query-budget-${randomBytes(6).toString("hex")}`;
  const loginCodeHash = hash(randomBytes(32).toString("base64url"));
  let queryCount = 0;
  const resolved = await resolveOAuthIdentity({
    providerId: "google",
    profile: {
      providerUserId,
      email,
      displayName: "OAuth Query Budget",
      emailVerified: true,
      raw: { sub: providerUserId, email }
    },
    loginCode: {
      codeHash: loginCodeHash,
      expiresAt: new Date(Date.now() + 120_000)
    },
    transactionRunner: (work) => transaction((client) => work({
      query(...args) {
        queryCount += 1;
        return client.query(...args);
      }
    }))
  });
  context.after(async () => query(`DELETE FROM users WHERE id = $1`, [resolved.user.id]));

  assert.ok(queryCount <= 10, `expected at most 10 SQL round trips, received ${queryCount}`);
  assert.equal((await query(
    `SELECT 1 FROM oauth_login_codes WHERE code_hash = $1 AND user_id = $2`,
    [loginCodeHash, resolved.user.id]
  )).rowCount, 1);
});

test("concurrent guest callbacks cannot reassign an oauth provider identity", async (context) => {
  const guests = await query(
    `INSERT INTO users (display_name, user_kind, email)
     VALUES ('OAuth Guest A', 'guest', NULL), ('OAuth Guest B', 'guest', NULL)
     RETURNING id`
  );
  const guestIds = guests.rows.map((row) => row.id);
  const email = `oauth-guest-race-${Date.now()}@example.com`;
  const providerUserId = `google-guest-race-${randomBytes(6).toString("hex")}`;
  const profile = {
    providerUserId,
    email,
    displayName: "OAuth Guest Race",
    emailVerified: true,
    raw: { sub: providerUserId, email }
  };
  context.after(async () => query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [guestIds]));

  const resolved = await Promise.all(guestIds.map((guestUserId) => resolveOAuthIdentity({
    providerId: "google",
    profile,
    guestUserId
  })));
  assert.equal(resolved[0].user.id, resolved[1].user.id);

  const link = await query(
    `SELECT user_id FROM oauth_accounts
     WHERE provider = 'google' AND provider_user_id = $1`,
    [providerUserId]
  );
  assert.equal(link.rowCount, 1);
  assert.equal(link.rows[0].user_id, resolved[0].user.id);
  const userStates = await query(
    `SELECT id, user_kind, email FROM users WHERE id = ANY($1::uuid[]) ORDER BY id`,
    [guestIds]
  );
  assert.equal(userStates.rows.filter((row) => row.user_kind === "registered").length, 1);
  assert.equal(userStates.rows.filter((row) => row.user_kind === "guest").length, 1);
});

test("unverified provider email cannot create or take over an existing identity", async (context) => {
  const email = `oauth-unverified-${Date.now()}@example.com`;
  const inserted = await query(
    `INSERT INTO users (email, display_name, user_kind, email_verified_at)
     VALUES ($1, 'Unverified Existing', 'registered', NULL)
     RETURNING id`,
    [email]
  );
  const userId = inserted.rows[0].id;
  const providerUserId = `github-unverified-${randomBytes(6).toString("hex")}`;
  context.after(async () => query(`DELETE FROM users WHERE id = $1`, [userId]));

  await assert.rejects(
    resolveOAuthIdentity({
      providerId: "github",
      profile: {
        providerUserId,
        email,
        displayName: "Unverified GitHub",
        emailVerified: false,
        raw: { id: providerUserId, email }
      }
    }),
    (error) => {
      assert.equal(error.code, "OAUTH_EMAIL_UNVERIFIED");
      return true;
    }
  );
  assert.equal((await query(
    `SELECT 1 FROM oauth_accounts WHERE provider = 'github' AND provider_user_id = $1`,
    [providerUserId]
  )).rowCount, 0);
  assert.equal((await query(
    `SELECT 1 FROM users WHERE id = $1 AND email_verified_at IS NOT NULL`,
    [userId]
  )).rowCount, 0);

  const verified = await resolveOAuthIdentity({
    providerId: "github",
    profile: {
      providerUserId,
      email,
      displayName: "Verified GitHub",
      emailVerified: true,
      raw: { id: providerUserId, email }
    }
  });
  assert.equal(verified.user.id, userId);
  assert.ok(verified.user.email_verified_at);
});

test("oauth login-code consumption rolls back when session creation fails", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());
  const email = `oauth-code-rollback-${Date.now()}@zhimu.local`;
  const registered = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, displayName: "OAuth Code Rollback", password: "oauth-code-pass-123" }
  });
  assert.equal(registered.statusCode, 201, registered.body);
  const userId = registered.json().user.id;
  const code = randomBytes(32).toString("base64url");
  const codeHash = hash(code);
  await query(
    `INSERT INTO oauth_login_codes (code_hash, user_id, expires_at)
     VALUES ($1, $2, now() + interval '2 minutes')`,
    [codeHash, userId]
  );
  context.after(async () => {
    await query(`DROP TRIGGER IF EXISTS test_fail_oauth_session_insert_trigger ON auth_sessions`);
    await query(`DROP FUNCTION IF EXISTS test_fail_oauth_session_insert()`);
    await query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  await query(`
    CREATE OR REPLACE FUNCTION test_fail_oauth_session_insert()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'forced oauth session failure';
    END $$`);
  await query(`
    CREATE TRIGGER test_fail_oauth_session_insert_trigger
    BEFORE INSERT ON auth_sessions
    FOR EACH STATEMENT EXECUTE FUNCTION test_fail_oauth_session_insert()`);

  const failed = await app.inject({
    method: "POST",
    url: "/api/auth/oauth/complete",
    payload: { code }
  });
  assert.equal(failed.statusCode, 500, failed.body);
  assert.equal((await query(
    `SELECT 1 FROM oauth_login_codes WHERE code_hash = $1`,
    [codeHash]
  )).rowCount, 1);

  await query(`DROP TRIGGER test_fail_oauth_session_insert_trigger ON auth_sessions`);
  await query(`DROP FUNCTION test_fail_oauth_session_insert()`);
  const retry = await app.inject({
    method: "POST",
    url: "/api/auth/oauth/complete",
    payload: { code }
  });
  assert.equal(retry.statusCode, 200, retry.body);
  assert.equal(retry.json().user.email, email);
});
