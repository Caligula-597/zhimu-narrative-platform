import assert from "node:assert/strict";
import test from "node:test";
import { query } from "../src/db.js";
import { worldInviteEmailHtml } from "../src/email/templates.js";
import { fetchUserPlanCode, setUserPlan } from "../src/plans.js";
import {
  handleStripeWebhook,
  isStripeConfigured,
  planCodeForPriceId,
  processStripeWebhookEvent,
  signStripePayloadForTest,
  verifyStripeWebhookSignature
} from "../src/stripe-billing.js";

const WEBHOOK_SECRET = "whsec_test_stripe_billing";
const PRICE_CREATOR = "price_creator_test";
const PRICE_STUDIO = "price_studio_test";

function stripeTestEnv() {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.STRIPE_PRICE_CREATOR = PRICE_CREATOR;
  process.env.STRIPE_PRICE_STUDIO = PRICE_STUDIO;
}

function captureEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(saved) {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const STRIPE_ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_CREATOR",
  "STRIPE_PRICE_STUDIO"
];

async function createRegisteredUser(email) {
  const created = await query(
    `INSERT INTO users (email, display_name, password_hash, password_salt, email_verified_at)
     VALUES ($1, 'Stripe User', 'x', 'y', now()) RETURNING id`,
    [email]
  );
  const userId = created.rows[0].id;
  await setUserPlan(userId, "free");
  return userId;
}

async function cleanupStripeUser(userId) {
  if (!userId) return;
  await query(`DELETE FROM stripe_webhook_events WHERE event_id LIKE 'evt_test_%'`);
  await query(`DELETE FROM stripe_billing_subscriptions WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM stripe_billing_customers WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM user_plans WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM users WHERE id = $1`, [userId]);
}

test("planCodeForPriceId maps configured Stripe prices", () => {
  stripeTestEnv();
  assert.equal(planCodeForPriceId(PRICE_CREATOR), "creator");
  assert.equal(planCodeForPriceId(PRICE_STUDIO), "studio");
  assert.equal(planCodeForPriceId("price_unknown"), null);
});

test("verifyStripeWebhookSignature accepts valid signature", () => {
  const rawBody = JSON.stringify({ hello: "world" });
  const header = signStripePayloadForTest(rawBody, WEBHOOK_SECRET);
  assert.equal(verifyStripeWebhookSignature(rawBody, header, WEBHOOK_SECRET), true);
  assert.equal(verifyStripeWebhookSignature(rawBody, header, "wrong"), false);
});

test("subscription webhook activates creator plan", async (context) => {
  stripeTestEnv();
  const email = `stripe-active-${Date.now()}@example.com`;
  const userId = await createRegisteredUser(email);
  context.after(async () => cleanupStripeUser(userId));

  const event = {
    id: `evt_test_active_${Date.now()}`,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: `sub_test_${Date.now()}`,
        customer: `cus_test_${Date.now()}`,
        status: "active",
        current_period_end: Math.floor(Date.now() / 1000) + 86_400,
        metadata: { userId },
        items: { data: [{ price: { id: PRICE_CREATOR } }] }
      }
    }
  };

  const result = await processStripeWebhookEvent(event);
  assert.equal(result.userId, userId);
  assert.equal(result.planCode, "creator");
  assert.equal(await fetchUserPlanCode(userId), "creator");
});

test("subscription canceled downgrades to free", async (context) => {
  stripeTestEnv();
  const email = `stripe-cancel-${Date.now()}@example.com`;
  const userId = await createRegisteredUser(email);
  context.after(async () => cleanupStripeUser(userId));

  const subId = `sub_test_cancel_${Date.now()}`;
  const customerId = `cus_test_cancel_${Date.now()}`;

  await processStripeWebhookEvent({
    id: `evt_test_setup_${Date.now()}`,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: subId,
        customer: customerId,
        status: "active",
        current_period_end: Math.floor(Date.now() / 1000) + 86_400,
        metadata: { userId },
        items: { data: [{ price: { id: PRICE_STUDIO } }] }
      }
    }
  });
  assert.equal(await fetchUserPlanCode(userId), "studio");

  await processStripeWebhookEvent({
    id: `evt_test_cancel_${Date.now()}`,
    type: "customer.subscription.deleted",
    data: {
      object: {
        id: subId,
        customer: customerId,
        status: "canceled",
        current_period_end: Math.floor(Date.now() / 1000),
        metadata: { userId },
        items: { data: [{ price: { id: PRICE_STUDIO } }] }
      }
    }
  });
  assert.equal(await fetchUserPlanCode(userId), "free");
});

test("internal beta plan is preserved when subscription ends", async (context) => {
  stripeTestEnv();
  const email = `stripe-beta-${Date.now()}@zhimu.local`;
  const userId = await createRegisteredUser(email);
  await setUserPlan(userId, "beta");
  context.after(async () => cleanupStripeUser(userId));

  const result = await processStripeWebhookEvent({
    id: `evt_test_beta_${Date.now()}`,
    type: "customer.subscription.deleted",
    data: {
      object: {
        id: `sub_beta_${Date.now()}`,
        customer: `cus_beta_${Date.now()}`,
        status: "canceled",
        metadata: { userId },
        items: { data: [{ price: { id: PRICE_CREATOR } }] }
      }
    }
  });
  assert.equal(result.planCode, "beta");
  assert.equal(await fetchUserPlanCode(userId), "beta");
});

test("handleStripeWebhook deduplicates signed events", async (context) => {
  const saved = captureEnv(STRIPE_ENV_KEYS);
  stripeTestEnv();
  context.after(() => restoreEnv(saved));

  const email = `stripe-hook-${Date.now()}@example.com`;
  const userId = await createRegisteredUser(email);
  context.after(async () => cleanupStripeUser(userId));

  const event = {
    id: `evt_test_hook_${Date.now()}`,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: `sub_hook_${Date.now()}`,
        customer: `cus_hook_${Date.now()}`,
        status: "active",
        current_period_end: Math.floor(Date.now() / 1000) + 86_400,
        metadata: { userId },
        items: { data: [{ price: { id: PRICE_CREATOR } }] }
      }
    }
  };
  const rawBody = JSON.stringify(event);
  const signature = signStripePayloadForTest(rawBody, WEBHOOK_SECRET);

  const first = await handleStripeWebhook(rawBody, signature);
  assert.equal(first.result.userId, userId);
  assert.equal(await fetchUserPlanCode(userId), "creator");

  const second = await handleStripeWebhook(rawBody, signature);
  assert.equal(second.duplicate, true);
});

test("handleStripeWebhook rejects invalid signature", async () => {
  stripeTestEnv();
  await assert.rejects(
    () => handleStripeWebhook("{}", "t=1,v1=deadbeef"),
    (error) => error.code === "STRIPE_WEBHOOK_INVALID"
  );
});

test("checkout requires Stripe secret key", () => {
  const saved = captureEnv(["STRIPE_SECRET_KEY"]);
  delete process.env.STRIPE_SECRET_KEY;
  try {
    assert.equal(isStripeConfigured(), false);
  } finally {
    restoreEnv(saved);
  }
});

test("world invite email uses branded HTML template", () => {
  const html = worldInviteEmailHtml({
    inviterName: "Alice",
    worldName: "雾港来信",
    roleLabel: "编辑",
    inviteUrl: "http://127.0.0.1:4173/?invite=abc"
  });
  assert.ok(html.includes("织幕"));
  assert.ok(html.includes("接受协作邀请"));
  assert.ok(html.includes("雾港来信"));
  assert.ok(html.includes("linear-gradient"));
});
