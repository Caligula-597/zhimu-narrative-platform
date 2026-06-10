/**
 * Account entitlements — plan, quota usage, and capability flags for the current user.
 */
import { CAPABILITIES, fetchUserKind } from "./capabilities.js";
import { isEmailVerificationRequired, isUserEmailVerified } from "./email-verification-policy.js";
import {
  buildUsagePayload,
  fetchUserPlanCode,
  planMeta,
  PLAN_CATALOG,
  PLAN_DEFAULTS
} from "./plans.js";
import { storageUsage } from "./routes/world-helpers.js";
import { throwErr } from "./api-errors.js";

export async function resolveAccountCapabilities(userId) {
  const kind = await fetchUserKind(userId);
  const capabilities = {};
  for (const [key, spec] of Object.entries(CAPABILITIES)) {
    let allowed = spec.accountKinds.includes(kind);
    if (allowed && spec.requireVerifiedEmail && isEmailVerificationRequired()) {
      allowed = await isUserEmailVerified(userId);
    }
    capabilities[key] = allowed;
  }
  return { userKind: kind, capabilities };
}

export async function buildAccountEntitlements(userId) {
  const [usageRow, planCode, access] = await Promise.all([
    storageUsage(userId),
    fetchUserPlanCode(userId),
    resolveAccountCapabilities(userId)
  ]);
  const meta = planMeta(planCode);
  const planDefaults = PLAN_DEFAULTS[planCode] ?? PLAN_DEFAULTS.free;

  return {
    userKind: access.userKind,
    isGuest: access.userKind === "guest",
    plan: {
      code: planCode,
      label: meta.label,
      tier: meta.tier,
      description: meta.description,
      isInternalBeta: planCode === "beta",
      limits: {
        maxWorlds: planDefaults.max_worlds,
        maxBytes: planDefaults.max_bytes,
        maxSingleFileBytes: planDefaults.max_single_file_bytes
      }
    },
    usage: buildUsagePayload(
      {
        planCode,
        max_bytes: usageRow.max_bytes,
        max_worlds: usageRow.max_worlds,
        max_single_file_bytes: usageRow.max_single_file_bytes
      },
      {
        usedBytes: Number(usageRow.used_bytes),
        usedWorlds: Number(usageRow.used_worlds)
      }
    ),
    capabilities: access.capabilities,
    publicPlans: Object.entries(PLAN_CATALOG)
      .filter(([code]) => code !== "beta")
      .map(([code, info]) => ({ code, ...info }))
  };
}

export async function assignUserPlanByEmail(email, planCode) {
  const { query } = await import("./db.js");
  const { setUserPlan } = await import("./plans.js");
  const { applyInternalBetaPrivileges } = await import("./internal-accounts.js");

  const normalized = email.trim().toLowerCase();
  const row = await query(
    `SELECT id FROM users WHERE lower(email) = $1 AND user_kind = 'registered'`,
    [normalized]
  );
  if (!row.rowCount) throwErr("USER_NOT_FOUND");
  const userId = row.rows[0].id;
  await setUserPlan(userId, planCode);
  if (planCode === "beta") {
    await applyInternalBetaPrivileges(userId, normalized);
  }
  return { userId, email: normalized, planCode };
}
