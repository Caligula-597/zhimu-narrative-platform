/** Plan defaults merged with per-user storage_quotas overrides. */
import { query } from "./db.js";
import { isInternalBetaEmail } from "./internal-accounts.js";

export const PLAN_DEFAULTS = {
  free: {
    max_worlds: 2,
    max_bytes: 524_288_000,
    max_single_file_bytes: 31_457_280
  },
  creator: {
    max_worlds: 10,
    max_bytes: 2_147_483_648,
    max_single_file_bytes: 104_857_600
  },
  studio: {
    max_worlds: 50,
    max_bytes: 10_737_418_240,
    max_single_file_bytes: 524_288_000
  },
  /** Internal closed-beta tier — generous limits, not sold publicly yet. */
  beta: {
    max_worlds: 100,
    max_bytes: 53_687_091_200,
    max_single_file_bytes: 1_073_741_824
  }
};

export const PLAN_CATALOG = {
  free: { label: "免费版", tier: "standard", description: "体验与轻量创作" },
  creator: { label: "创作者", tier: "standard", description: "独立作者与小团队" },
  studio: { label: "工作室", tier: "standard", description: "多剧本并行与更大存储" },
  beta: { label: "内测", tier: "internal", description: "内测账号 · 配额已提升" }
};

export function planMeta(planCode) {
  return PLAN_CATALOG[planCode] ?? PLAN_CATALOG.free;
}

export function initialPlanForEmail(email) {
  return isInternalBetaEmail(email) ? "beta" : "free";
}

export async function fetchUserPlanCode(userId) {
  const result = await query(`SELECT plan_code FROM user_plans WHERE user_id = $1`, [userId]);
  return result.rows[0]?.plan_code ?? "free";
}

/** Effective limits: max(plan default, storage_quotas row) for each field. */
export async function effectiveStorageLimits(userId) {
  const planCode = await fetchUserPlanCode(userId);
  const plan = PLAN_DEFAULTS[planCode] ?? PLAN_DEFAULTS.free;

  const row = await query(
    `SELECT max_bytes, max_worlds, max_single_file_bytes
     FROM storage_quotas WHERE user_id = $1`,
    [userId]
  );

  const stored = row.rows[0];
  return {
    planCode,
    max_worlds: Math.max(plan.max_worlds, Number(stored?.max_worlds ?? 0)),
    max_bytes: Math.max(plan.max_bytes, Number(stored?.max_bytes ?? 0)),
    max_single_file_bytes: Math.max(plan.max_single_file_bytes, Number(stored?.max_single_file_bytes ?? 0))
  };
}

export async function ensureUserPlan(userId, planCode = "free") {
  await query(
    `INSERT INTO user_plans (user_id, plan_code) VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, planCode]
  );
}

export async function setUserPlan(userId, planCode) {
  if (!PLAN_DEFAULTS[planCode]) {
    const error = new Error(`Unknown plan: ${planCode}`);
    error.statusCode = 400;
    throw error;
  }
  await query(
    `INSERT INTO user_plans (user_id, plan_code) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET plan_code = EXCLUDED.plan_code, updated_at = now()`,
    [userId, planCode]
  );
}

export async function countOwnedWorlds(userId) {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM worlds WHERE owner_user_id = $1 AND status <> 'archived'`,
    [userId]
  );
  return result.rows[0]?.count ?? 0;
}

export function buildUsagePayload(limits, { usedBytes, usedWorlds }) {
  const meta = planMeta(limits.planCode);
  const maxBytes = limits.max_bytes;
  const maxWorlds = limits.max_worlds;
  return {
    planCode: limits.planCode,
    planLabel: meta.label,
    planTier: meta.tier,
    planDescription: meta.description,
    isInternalBeta: limits.planCode === "beta",
    maxBytes,
    maxWorlds,
    maxSingleFileBytes: limits.max_single_file_bytes,
    usedBytes,
    remainingBytes: Math.max(0, maxBytes - usedBytes),
    usedWorlds,
    remainingWorlds: Math.max(0, maxWorlds - usedWorlds),
    storagePercent: maxBytes ? Math.min(100, Math.round((usedBytes / maxBytes) * 100)) : 0,
    worldsPercent: maxWorlds ? Math.min(100, Math.round((usedWorlds / maxWorlds) * 100)) : 0
  };
}
