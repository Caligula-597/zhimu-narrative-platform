/**
 * Central quota checks — single place for limits + structured error details.
 */
import { throwErr } from "./api-errors.js";
import { storageUsage } from "./routes/world-access-service.js";
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

export async function fetchActorQuota(userId, client = null) {
  return storageUsage(userId, client);
}

export async function assertWorldCreateQuota(userId, { client = null } = {}) {
  const usage = await fetchActorQuota(userId, client);
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

export async function assertStorageBytesQuota(userId, additionalBytes = 0, { client = null } = {}) {
  const usage = await fetchActorQuota(userId, client);
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

export async function assertSingleFileQuota(userId, byteSize, { client = null } = {}) {
  const usage = await fetchActorQuota(userId, client);
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

export async function lockWorldQuotaAdmission(client, userId) {
  if (!client?.query) throw new TypeError("A transaction client is required for world quota admission");
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))",
    [`world-quota:${userId}`]
  );
}

/**
 * Final world admission belongs in the same transaction as the INSERT. The
 * per-account lock makes the subsequent usage snapshot authoritative even
 * when several creation endpoints are called concurrently.
 */
export async function admitWorldCreation(client, userId) {
  await lockWorldQuotaAdmission(client, userId);
  return assertWorldCreateQuota(userId, { client });
}

export async function assertAssetUploadQuota(userId, byteSize, {
  client = null,
  fetchQuota = fetchActorQuota
} = {}) {
  const usage = await fetchQuota(userId, client);
  const size = Number(byteSize);
  const maxSingle = Number(usage.max_single_file_bytes);
  if (!Number.isSafeInteger(size) || size <= 0 || size > maxSingle) {
    throwErr("FILE_TOO_LARGE", undefined, quotaErrorDetails(usage, {
      quotaType: "single_file",
      requestedBytes: size,
      maxSingleFileBytes: maxSingle
    }));
  }
  const used = Number(usage.used_bytes);
  const max = Number(usage.max_bytes);
  if (used + size > max) {
    throwErr("STORAGE_QUOTA_EXCEEDED", undefined, quotaErrorDetails(usage, {
      quotaType: "storage",
      requestedBytes: size,
      shortfallBytes: used + size - max
    }));
  }
  return usage;
}

export async function lockAssetQuotaAdmission(client, userId) {
  if (!client?.query) throw new TypeError("A transaction client is required for asset quota admission");
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))",
    [`asset-quota:${userId}`]
  );
}

/**
 * Request-scoped reservation for imports that upload several objects before
 * their asset rows become visible to storageUsage(). This closes the gap where
 * every file passed an isolated quota check while their combined bytes did not.
 */
export async function createStorageQuotaReservation(userId, {
  fetchQuota = fetchActorQuota
} = {}) {
  const usage = await fetchQuota(userId);
  const usedBytes = Number(usage.used_bytes ?? 0);
  const maxBytes = Number(usage.max_bytes);
  const maxSingleFileBytes = Number(usage.max_single_file_bytes);
  let reservedBytes = 0;

  return {
    get reservedBytes() {
      return reservedBytes;
    },
    reserve(byteSize) {
      const size = Number(byteSize);
      if (!Number.isSafeInteger(size) || size <= 0 || size > maxSingleFileBytes) {
        throwErr("FILE_TOO_LARGE", undefined, quotaErrorDetails(usage, {
          quotaType: "single_file",
          requestedBytes: size,
          maxSingleFileBytes
        }));
      }
      if (usedBytes + reservedBytes + size > maxBytes) {
        throwErr("STORAGE_QUOTA_EXCEEDED", undefined, quotaErrorDetails(usage, {
          quotaType: "storage",
          requestedBytes: size,
          reservedBytes,
          shortfallBytes: usedBytes + reservedBytes + size - maxBytes
        }));
      }
      reservedBytes += size;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        reservedBytes = Math.max(0, reservedBytes - size);
      };
    }
  };
}
