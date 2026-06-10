import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { isInternalBetaEmail, applyInternalBetaPrivileges } from "../src/internal-accounts.js";
import { effectiveStorageLimits, setUserPlan, PLAN_DEFAULTS } from "../src/plans.js";

test("isInternalBetaEmail matches allowlist and domains", () => {
  assert.equal(isInternalBetaEmail("host@zhimu.local"), true);
  assert.equal(isInternalBetaEmail("test@getzhimu.com"), false);
  const prevDomains = process.env.INTERNAL_BETA_EMAIL_DOMAINS;
  process.env.INTERNAL_BETA_EMAIL_DOMAINS = "getzhimu.com";
  assert.equal(isInternalBetaEmail("dev@getzhimu.com"), true);
  assert.equal(isInternalBetaEmail("host@zhimu.local"), true);
  if (prevDomains === undefined) delete process.env.INTERNAL_BETA_EMAIL_DOMAINS;
  else process.env.INTERNAL_BETA_EMAIL_DOMAINS = prevDomains;

  const prevEmails = process.env.INTERNAL_BETA_EMAILS;
  process.env.INTERNAL_BETA_EMAILS = "friend@example.com";
  assert.equal(isInternalBetaEmail("friend@example.com"), true);
  if (prevEmails === undefined) delete process.env.INTERNAL_BETA_EMAILS;
  else process.env.INTERNAL_BETA_EMAILS = prevEmails;
});

test("register assigns beta plan for internal email domain", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const email = `beta-tester-${Date.now()}@zhimu.local`;
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, displayName: "内测用户", password: "beta-pass-123" }
  });
  assert.equal(response.statusCode, 201, response.body);
  const userId = response.json().user.id;

  context.after(async () => {
    await query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  const limits = await effectiveStorageLimits(userId);
  assert.equal(limits.planCode, "beta");
  assert.equal(limits.max_worlds, PLAN_DEFAULTS.beta.max_worlds);

  const usage = await app.inject({
    method: "GET",
    url: "/api/storage/usage",
    headers: { authorization: `Bearer ${response.json().token}` }
  });
  assert.equal(usage.statusCode, 200, usage.body);
  const body = usage.json();
  assert.equal(body.planCode, "beta");
  assert.equal(body.planLabel, "内测");
  assert.equal(body.isInternalBeta, true);
  assert.ok(typeof body.usedWorlds === "number");
  assert.ok(typeof body.remainingWorlds === "number");
});

test("applyInternalBetaPrivileges upgrades existing free user", async (context) => {
  const email = `manual-beta-${Date.now()}@zhimu.local`;
  const created = await query(
    `INSERT INTO users (email, display_name, password_hash, password_salt, email_verified_at)
     VALUES ($1, 'Manual Beta', 'x', 'y', now()) RETURNING id`,
    [email]
  );
  const userId = created.rows[0].id;

  context.after(async () => {
    await query(`DELETE FROM user_plans WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  await setUserPlan(userId, "free");
  const applied = await applyInternalBetaPrivileges(userId, email);
  assert.equal(applied, true);
  const limits = await effectiveStorageLimits(userId);
  assert.equal(limits.planCode, "beta");
});

test("GET /account/plans lists public tiers only", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/api/account/plans" });
  assert.equal(response.statusCode, 200);
  const codes = response.json().plans.map((p) => p.code);
  assert.ok(codes.includes("free"));
  assert.ok(codes.includes("creator"));
  assert.ok(!codes.includes("beta"));
});
