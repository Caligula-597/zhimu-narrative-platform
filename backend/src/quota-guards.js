/**
 * Central quota checks — single place for limits + structured error details.
 */
import { throwErr } from "./api-errors.js";
import { storageUsage } from "./routes/world-helpers.js";
import { buildUsagePayload, planMeta } from "./plans.js";

export function quotaErrorDetails(usageRow, extra = {}) {
  const limits = {
    planCode: usageRow.plan_code,
    max_bytes: usageRow.max_bytes,
    max_worlds: usageRow.max_worlds,
    max_single_file_bytes: usageRow.max_single_file_bytes
  };
  const payload = buildUsagePayload(limits, {
    usedBytes: Number(usageRow.used_bytes ?? 0),
    usedWorlds: Number(usageRow.used_worlds ?? 0)
  });
  return { ...payload, ...extra };
}

export async function fetchActorQuota(userId) {
  return storageUsage(userId);
}

export async function assertWorldCreateQuota(userId) {
  const usage = await fetchActorQuota(userId);
  const usedWorlds = Number(usage.used_worlds ?? 0);
  const maxWorlds = Number(usage.max_worlds);
  if (usedWorlds >= maxWorlds) {
    throwErr("WORLD_QUOTA_EXCEEDED", undefined, quotaErrorDetails(usage, {
      quotaType: "worlds",
      requested: 1
    }));
  }
  return usage;
}

export async function assertStorageBytesQuota(userId, additionalBytes = 0) {
  const usage = await fetchActorQuota(userId);
  const used = Number(usage.used_bytes);
  const max = Number(usage.max_bytes);
  const add = Number(additionalBytes) || 0;
  if (used + add > max) {
    throwErr("STORAGE_QUOTA_EXCEEDED", undefined, quotaErrorDetails(usage, {
      quotaType: "storage",
      requestedBytes: add,
      shortfallBytes: used + add - max
    }));
  }
  return usage;
}

export async function assertSingleFileQuota(userId, byteSize) {
  const usage = await fetchActorQuota(userId);
  const size = Number(byteSize) || 0;
  const maxSingle = Number(usage.max_single_file_bytes);
  if (size > maxSingle) {
    throwErr("FILE_TOO_LARGE", undefined, quotaErrorDetails(usage, {
      quotaType: "single_file",
      requestedBytes: size,
      maxSingleFileBytes: maxSingle
    }));
  }
  return usage;
}
