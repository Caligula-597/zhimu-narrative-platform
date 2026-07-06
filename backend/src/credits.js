/**
 * 织幕积分 — 余额、流水、套餐月赠与正反馈奖励。
 * 首月默认 CREDITS_UI_VISIBLE=false；CREDITS_DEBIT_AI=false 不阻断 AI。
 */
import { query, transaction } from "./db.js";
import { fetchUserPlanCode } from "./plans.js";

/** 各套餐每月赠送积分（AI 创作消耗用） */
export const PLAN_MONTHLY_CREDITS = {
  free: 300,
  creator: 3000,
  studio: 12_000,
  beta: 50_000
};

export const SIGNUP_CREDIT_BONUS = 800;
export const FIRST_RECAP_CREDIT_REWARD = 200;
export const DEFAULT_AI_CREDIT_COST = 5;

/** 积分充值包（UI 上线后使用；草案定价） */
export const CREDIT_PACKS = [
  { code: "starter", label: "体验包", credits: 500, priceCny: 12, note: "约 100 次轻量 AI 辅助" },
  { code: "standard", label: "标准包", credits: 2000, priceCny: 39, note: "独立作者月度补充" },
  { code: "pro", label: "专业包", credits: 8000, priceCny: 128, note: "工作室批量创作" }
];

export function isCreditsSystemEnabled() {
  return process.env.CREDITS_SYSTEM_ENABLED !== "false";
}

export function isCreditsDebitAiEnabled() {
  return process.env.CREDITS_DEBIT_AI === "true";
}

export function isCreditsUiVisible() {
  const explicit = process.env.CREDITS_UI_VISIBLE?.trim();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  const after = process.env.CREDITS_UI_VISIBLE_AFTER?.trim();
  if (after) {
    const ts = Date.parse(after);
    if (!Number.isNaN(ts) && Date.now() >= ts) return true;
  }
  return false;
}

export function aiCreditCost() {
  const n = Number(process.env.CREDITS_AI_COST ?? DEFAULT_AI_CREDIT_COST);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_AI_CREDIT_COST;
}

export function monthlyCreditsForPlan(planCode) {
  return PLAN_MONTHLY_CREDITS[planCode] ?? PLAN_MONTHLY_CREDITS.free;
}

function dbExec(client) {
  if (client && typeof client.query === "function") {
    return (text, params) => client.query(text, params);
  }
  return query;
}

async function fetchBalanceRow(userId, client) {
  const exec = dbExec(client);
  const result = await exec(
    `SELECT balance, lifetime_granted, lifetime_spent, last_monthly_grant_at
     FROM user_credit_balances WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function fetchCreditBalance(userId) {
  const row = await fetchBalanceRow(userId);
  return {
    balance: Number(row?.balance ?? 0),
    lifetimeGranted: Number(row?.lifetime_granted ?? 0),
    lifetimeSpent: Number(row?.lifetime_spent ?? 0),
    lastMonthlyGrantAt: row?.last_monthly_grant_at ?? null
  };
}

async function ensureBalanceRow(userId, client) {
  const exec = dbExec(client);
  await exec(
    `INSERT INTO user_credit_balances (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

export async function grantCredits(userId, amount, reason, { refType = null, refId = null, idempotencyKey = null } = {}) {
  const delta = Math.round(Number(amount));
  if (!isCreditsSystemEnabled() || !userId || delta <= 0) {
    return fetchCreditBalance(userId);
  }

  return transaction(async (client) => {
    const exec = dbExec(client);
    await ensureBalanceRow(userId, client);
    if (idempotencyKey) {
      const dup = await exec(`SELECT 1 FROM credit_ledger WHERE idempotency_key = $1`, [idempotencyKey]);
      if (dup.rowCount) return fetchCreditBalance(userId);
    }
    await exec(
      `UPDATE user_credit_balances
       SET balance = balance + $2,
           lifetime_granted = lifetime_granted + $2,
           updated_at = now()
       WHERE user_id = $1`,
      [userId, delta]
    );
    await exec(
      `INSERT INTO credit_ledger (user_id, delta, reason, ref_type, ref_id, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, delta, reason, refType, refId, idempotencyKey]
    );
    return fetchCreditBalance(userId);
  });
}

export async function debitCredits(userId, amount, reason, { refType = null, refId = null, idempotencyKey = null } = {}) {
  const delta = Math.round(Number(amount));
  if (!isCreditsSystemEnabled() || !userId || delta <= 0) {
    return fetchCreditBalance(userId);
  }

  return transaction(async (client) => {
    const exec = dbExec(client);
    await ensureBalanceRow(userId, client);
    if (idempotencyKey) {
      const dup = await exec(`SELECT 1 FROM credit_ledger WHERE idempotency_key = $1`, [idempotencyKey]);
      if (dup.rowCount) return fetchCreditBalance(userId);
    }
    const row = await fetchBalanceRow(userId, client);
    if (Number(row?.balance ?? 0) < delta) {
      const error = new Error("Insufficient credits");
      error.code = "CREDITS_EXHAUSTED";
      error.statusCode = 402;
      throw error;
    }
    await exec(
      `UPDATE user_credit_balances
       SET balance = balance - $2,
           lifetime_spent = lifetime_spent + $2,
           updated_at = now()
       WHERE user_id = $1`,
      [userId, delta]
    );
    await exec(
      `INSERT INTO credit_ledger (user_id, delta, reason, ref_type, ref_id, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, -delta, reason, refType, refId, idempotencyKey]
    );
    return fetchCreditBalance(userId);
  });
}

export async function assertAiCredits(userId) {
  if (!isCreditsSystemEnabled() || !isCreditsDebitAiEnabled()) return;
  const { balance } = await fetchCreditBalance(userId);
  if (balance < aiCreditCost()) {
    const error = new Error("Insufficient credits for AI request");
    error.code = "CREDITS_EXHAUSTED";
    error.statusCode = 402;
    throw error;
  }
}

export async function chargeAiCredits(userId, { refType = "ai", refId = null, idempotencyKey = null } = {}) {
  if (!isCreditsSystemEnabled() || !isCreditsDebitAiEnabled()) return;
  await debitCredits(userId, aiCreditCost(), "ai_request", { refType, refId, idempotencyKey });
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function ensureUserCredits(userId) {
  if (!isCreditsSystemEnabled() || !userId) {
    return fetchCreditBalance(userId);
  }

  await ensureBalanceRow(userId);
  const planCode = await fetchUserPlanCode(userId);
  const monthKey = currentMonthKey();

  await grantCredits(userId, SIGNUP_CREDIT_BONUS, "signup_bonus", {
    idempotencyKey: `signup:${userId}`
  });

  const monthly = monthlyCreditsForPlan(planCode);
  if (monthly > 0) {
    await grantCredits(userId, monthly, "monthly_grant", {
      refType: "plan",
      refId: planCode,
      idempotencyKey: `monthly:${userId}:${monthKey}`
    });
    await query(
      `UPDATE user_credit_balances SET last_monthly_grant_at = now(), updated_at = now() WHERE user_id = $1`,
      [userId]
    );
  }

  return fetchCreditBalance(userId);
}

export async function rewardFirstRecap(userId, recapId) {
  if (!isCreditsSystemEnabled() || !userId) return null;
  const before = await fetchCreditBalance(userId);
  await grantCredits(userId, FIRST_RECAP_CREDIT_REWARD, "first_recap", {
    refType: "recap",
    refId: recapId,
    idempotencyKey: `first_recap:${userId}`
  });
  const after = await fetchCreditBalance(userId);
  if (after.balance > before.balance) {
    return { granted: true, amount: FIRST_RECAP_CREDIT_REWARD };
  }
  return null;
}

export function buildCreditsPayload(balanceRow, planCode) {
  const balance = Number(balanceRow?.balance ?? 0);
  const monthlyGrant = monthlyCreditsForPlan(planCode);
  return {
    enabled: isCreditsSystemEnabled(),
    uiVisible: isCreditsUiVisible(),
    debitAi: isCreditsDebitAiEnabled(),
    balance,
    monthlyGrant,
    aiCost: aiCreditCost(),
    lifetimeGranted: Number(balanceRow?.lifetimeGranted ?? balanceRow?.lifetime_granted ?? 0),
    lifetimeSpent: Number(balanceRow?.lifetimeSpent ?? balanceRow?.lifetime_spent ?? 0),
    packs: CREDIT_PACKS,
    note: isCreditsUiVisible()
      ? "积分用于 AI 辅助创作；完成首场复盘等操作可获得额外奖励。"
      : "积分系统已就绪，界面将于内测稳定后开放。"
  };
}
