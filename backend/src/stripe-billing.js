/**
 * Stripe billing — checkout sessions and webhook → user_plans sync.
 * Uses fetch against Stripe REST API (no SDK dependency).
 */
import crypto from "node:crypto";
import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import { fetchUserPlanCode, setUserPlan } from "./plans.js";
import { fetchUpstream, resolveUpstreamTimeoutMs } from "./upstream-fetch.js";

const STRIPE_API = "https://api.stripe.com/v1";
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function isBillingLaunchEnabled() {
  return process.env.BILLING_LAUNCH_ENABLED === "true";
}

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

export function stripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
}

export function isStripeConfigured() {
  return isBillingLaunchEnabled() && Boolean(stripeSecretKey());
}

export function getStripeBillingStatus() {
  const prices = getStripePriceMap();
  return {
    configured: isStripeConfigured(),
    webhookSecret: Boolean(stripeWebhookSecret()),
    prices: {
      creator: prices.creator ?? null,
      studio: prices.studio ?? null
    }
  };
}

function getStripePriceMap() {
  return {
    creator: process.env.STRIPE_PRICE_CREATOR?.trim() || null,
    studio: process.env.STRIPE_PRICE_STUDIO?.trim() || null
  };
}

export function planCodeForPriceId(priceId) {
  if (!priceId) return null;
  const prices = getStripePriceMap();
  if (priceId === prices.creator) return "creator";
  if (priceId === prices.studio) return "studio";
  return null;
}

export function priceIdForPlanCode(planCode) {
  const prices = getStripePriceMap();
  if (planCode === "creator") return prices.creator;
  if (planCode === "studio") return prices.studio;
  return null;
}

export function verifyStripeWebhookSignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false;
  const parts = Object.fromEntries(
    String(signatureHeader)
      .split(",")
      .map((p) => p.trim().split("="))
      .filter(([k, v]) => k && v)
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (ageSec > 300) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

async function stripeRequest(method, path, form = null) {
  const secret = stripeSecretKey();
  if (!secret) throwErr("STRIPE_NOT_CONFIGURED");

  const init = {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded"
    }
  };
  if (form) init.body = form;

  const response = await fetchUpstream(`${STRIPE_API}${path}`, init, {
    timeoutMs: resolveUpstreamTimeoutMs(process.env.STRIPE_REQUEST_TIMEOUT_MS)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || `Stripe API ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
    error.code = "STRIPE_API_ERROR";
    throw error;
  }
  return body;
}

function encodeForm(fields, prefix = "") {
  const parts = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object" && !Array.isArray(value)) {
      parts.push(encodeForm(value, fullKey));
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}

export async function getOrCreateStripeCustomer(userId, email) {
  const existing = await query(
    `SELECT stripe_customer_id FROM stripe_billing_customers WHERE user_id = $1`,
    [userId]
  );
  if (existing.rowCount) return existing.rows[0].stripe_customer_id;

  const customer = await stripeRequest(
    "POST",
    "/customers",
    encodeForm({ email, metadata: { userId } })
  );
  await query(
    `INSERT INTO stripe_billing_customers (user_id, stripe_customer_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id, updated_at = now()`,
    [userId, customer.id]
  );
  return customer.id;
}

export async function createStripeCheckoutSession({ userId, email, planCode }) {
  const priceId = priceIdForPlanCode(planCode);
  if (!priceId) {
    const error = new Error(`Plan ${planCode} is not available for checkout`);
    error.statusCode = 400;
    error.code = "STRIPE_PLAN_UNAVAILABLE";
    throw error;
  }

  const appUrl = (process.env.APP_PUBLIC_URL || "").trim().replace(/\/$/, "");
  if (!appUrl) throwErr("STRIPE_NOT_CONFIGURED");

  const customerId = await getOrCreateStripeCustomer(userId, email);
  const session = await stripeRequest(
    "POST",
    "/checkout/sessions",
    encodeForm({
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": 1,
      success_url: `${appUrl}/?billing=success`,
      cancel_url: `${appUrl}/?billing=cancel`,
      client_reference_id: userId,
      "metadata[userId]": userId,
      "metadata[planCode]": planCode,
      "subscription_data[metadata][userId]": userId,
      "subscription_data[metadata][planCode]": planCode
    })
  );

  return { url: session.url, sessionId: session.id };
}

async function claimWebhookEvent(eventId, eventType) {
  const inserted = await query(
    `INSERT INTO stripe_webhook_events (event_id, event_type)
     VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [eventId, eventType]
  );
  return inserted.rowCount > 0;
}

async function upsertSubscriptionRecord({
  userId,
  stripeSubscriptionId,
  stripeCustomerId,
  planCode,
  status,
  stripePriceId,
  currentPeriodEnd
}) {
  await query(
    `INSERT INTO stripe_billing_subscriptions
       (stripe_subscription_id, user_id, stripe_customer_id, plan_code, status, stripe_price_id, current_period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (stripe_subscription_id) DO UPDATE SET
       status = EXCLUDED.status,
       plan_code = EXCLUDED.plan_code,
       stripe_price_id = EXCLUDED.stripe_price_id,
       current_period_end = EXCLUDED.current_period_end,
       updated_at = now()`,
    [
      stripeSubscriptionId,
      userId,
      stripeCustomerId,
      planCode,
      status,
      stripePriceId ?? null,
      currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null
    ]
  );
}

async function syncUserPlanFromSubscriptions(userId) {
  const current = await fetchUserPlanCode(userId);
  if (current === "beta") return { planCode: "beta", reason: "internal_beta" };

  const active = await query(
    `SELECT plan_code FROM stripe_billing_subscriptions
     WHERE user_id = $1 AND status = ANY($2::text[])
     ORDER BY CASE plan_code WHEN 'studio' THEN 2 WHEN 'creator' THEN 1 ELSE 0 END DESC
     LIMIT 1`,
    [userId, [...ACTIVE_STATUSES]]
  );

  const nextPlan = active.rowCount ? active.rows[0].plan_code : "free";
  await setUserPlan(userId, nextPlan);
  return { planCode: nextPlan, reason: active.rowCount ? "subscription" : "no_active_subscription" };
}

async function resolveUserIdFromSubscription(subscription) {
  const metaUserId = subscription.metadata?.userId;
  if (metaUserId) return metaUserId;

  const customerId = subscription.customer;
  if (customerId) {
    const row = await query(
      `SELECT user_id FROM stripe_billing_customers WHERE stripe_customer_id = $1`,
      [customerId]
    );
    if (row.rowCount) return row.rows[0].user_id;
  }
  return null;
}

async function handleSubscriptionObject(subscription) {
  const userId = await resolveUserIdFromSubscription(subscription);
  if (!userId) return { skipped: true, reason: "user_not_linked" };

  const priceId = subscription.items?.data?.[0]?.price?.id ?? subscription.plan?.id ?? null;
  const planCode = planCodeForPriceId(priceId) ?? subscription.metadata?.planCode ?? null;
  if (!planCode || !["creator", "studio"].includes(planCode)) {
    return { skipped: true, reason: "unknown_price", priceId };
  }

  await upsertSubscriptionRecord({
    userId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer,
    planCode,
    status: subscription.status,
    stripePriceId: priceId,
    currentPeriodEnd: subscription.current_period_end
  });

  const sync = await syncUserPlanFromSubscriptions(userId);
  return { userId, planCode: sync.planCode, status: subscription.status };
}

async function handleCheckoutCompleted(session) {
  const userId = session.client_reference_id || session.metadata?.userId;
  if (!userId) return { skipped: true, reason: "missing_user" };

  if (session.customer) {
    await query(
      `INSERT INTO stripe_billing_customers (user_id, stripe_customer_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id, updated_at = now()`,
      [userId, session.customer]
    );
  }

  if (session.subscription && typeof session.subscription === "string") {
    const subscription = await stripeRequest("GET", `/subscriptions/${session.subscription}`);
    return handleSubscriptionObject(subscription);
  }

  const planCode = session.metadata?.planCode;
  if (planCode && ["creator", "studio"].includes(planCode)) {
    await setUserPlan(userId, planCode);
    return { userId, planCode };
  }
  return { skipped: true, reason: "no_subscription" };
}

export async function processStripeWebhookEvent(event) {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return handleSubscriptionObject(event.data.object);
    default:
      return { skipped: true, reason: "unhandled_event", type: event.type };
  }
}

export async function handleStripeWebhook(rawBody, signatureHeader) {
  if (!isBillingLaunchEnabled()) throwErr("STRIPE_NOT_CONFIGURED");
  const secret = stripeWebhookSecret();
  if (!secret) throwErr("STRIPE_NOT_CONFIGURED");
  if (!verifyStripeWebhookSignature(rawBody, signatureHeader, secret)) {
    throwErr("STRIPE_WEBHOOK_INVALID");
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    throwErr("STRIPE_WEBHOOK_INVALID");
  }

  if (!event?.id || !event?.type) throwErr("STRIPE_WEBHOOK_INVALID");

  const claimed = await claimWebhookEvent(event.id, event.type);
  if (!claimed) return { duplicate: true, eventId: event.id };

  const result = await processStripeWebhookEvent(event);
  return { eventId: event.id, type: event.type, result };
}

/** Test helper — build a valid Stripe-Signature header. */
export function signStripePayloadForTest(rawBody, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const payload = `${timestamp}.${rawBody}`;
  const signature = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `t=${timestamp},v1=${signature}`;
}
