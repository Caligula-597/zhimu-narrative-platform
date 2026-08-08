export function resolveHealthStatusCacheMs(
  raw = process.env.HEALTH_STATUS_CACHE_MS,
  nodeEnv = process.env.NODE_ENV ?? "development"
) {
  const fallback = nodeEnv === "production" ? 1000 : 0;
  const parsed = Number(raw ?? fallback);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10_000 ? parsed : fallback;
}

/** Coalesce concurrent probes and briefly reuse a successful snapshot. */
export function createHealthStatusLoader(loader, { ttlMs = 0, now = Date.now } = {}) {
  if (typeof loader !== "function") throw new TypeError("loader must be a function");
  let cached;
  let expiresAt = 0;
  let pending = null;

  return async function loadHealthStatus() {
    const current = now();
    if (cached !== undefined && current < expiresAt) return cached;
    if (pending) return pending;
    pending = Promise.resolve()
      .then(loader)
      .then((value) => {
        cached = value;
        expiresAt = now() + Math.max(0, ttlMs);
        return value;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };
}
