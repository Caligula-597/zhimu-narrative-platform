import assert from "node:assert/strict";
import test from "node:test";
import { query } from "../src/db.js";
import {
  ensureUserCredits,
  fetchCreditBalance,
  grantCredits,
  debitCredits,
  isCreditsUiVisible,
  rewardFirstRecap,
  SIGNUP_CREDIT_BONUS,
  monthlyCreditsForPlan
} from "../src/credits.js";

async function createTestUser() {
  const email = `credits-${Date.now()}-${Math.random().toString(36).slice(2)}@zhimu.local`;
  const row = await query(
    `INSERT INTO users (email, display_name, password_hash, password_salt, email_verified_at)
     VALUES ($1, 'Credits Test', 'x', 'y', now()) RETURNING id`,
    [email]
  );
  return row.rows[0].id;
}

async function cleanupUser(userId) {
  await query(`DELETE FROM credit_ledger WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM user_credit_balances WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM user_plans WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM users WHERE id = $1`, [userId]);
}

test("ensureUserCredits grants signup bonus and monthly grant once", async (context) => {
  const userId = await createTestUser();
  context.after(async () => cleanupUser(userId));

  await query(`INSERT INTO user_plans (user_id, plan_code) VALUES ($1, 'free') ON CONFLICT DO NOTHING`, [userId]);

  const first = await ensureUserCredits(userId);
  const second = await ensureUserCredits(userId);

  assert.equal(first.balance, SIGNUP_CREDIT_BONUS + monthlyCreditsForPlan("free"));
  assert.equal(second.balance, first.balance);
});

test("grantCredits idempotency key prevents duplicate grants", async (context) => {
  const userId = await createTestUser();
  context.after(async () => cleanupUser(userId));

  await grantCredits(userId, 100, "test", { idempotencyKey: `test:${userId}` });
  await grantCredits(userId, 100, "test", { idempotencyKey: `test:${userId}` });
  const balance = await fetchCreditBalance(userId);
  assert.equal(balance.balance, 100);
});

test("debitCredits rejects insufficient balance", async (context) => {
  const userId = await createTestUser();
  context.after(async () => cleanupUser(userId));

  await grantCredits(userId, 10, "seed");
  await assert.rejects(() => debitCredits(userId, 20, "overspend"), (error) => error.code === "CREDITS_EXHAUSTED");
});

test("rewardFirstRecap grants only once per user", async (context) => {
  const userId = await createTestUser();
  context.after(async () => cleanupUser(userId));

  const a = await rewardFirstRecap(userId, "recap-1");
  const b = await rewardFirstRecap(userId, "recap-2");
  assert.equal(a?.granted, true);
  assert.equal(b, null);
  const balance = await fetchCreditBalance(userId);
  assert.equal(balance.balance, 200);
});

test("isCreditsUiVisible defaults false without env", () => {
  const prevVisible = process.env.CREDITS_UI_VISIBLE;
  const prevAfter = process.env.CREDITS_UI_VISIBLE_AFTER;
  delete process.env.CREDITS_UI_VISIBLE;
  delete process.env.CREDITS_UI_VISIBLE_AFTER;
  try {
    assert.equal(isCreditsUiVisible(), false);
  } finally {
    if (prevVisible === undefined) delete process.env.CREDITS_UI_VISIBLE;
    else process.env.CREDITS_UI_VISIBLE = prevVisible;
    if (prevAfter === undefined) delete process.env.CREDITS_UI_VISIBLE_AFTER;
    else process.env.CREDITS_UI_VISIBLE_AFTER = prevAfter;
  }
});
