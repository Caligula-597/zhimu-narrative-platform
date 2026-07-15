/** Bounded in-process fixed-window limiter (edge/WAF remains authoritative across instances). */

const buckets = new Map();
const MAX_BUCKETS = 20_000;
const CLEANUP_EVERY = 500;
let operations = 0;

function bucketKey(request, routeKey) {
  if (request.actorId) return `${routeKey}:actor:${request.actorId}`;
  const ip = request.ip || request.socket?.remoteAddress || "unknown";
  return `${routeKey}:ip:${ip}`;
}

export function createRateLimiter({ windowMs = 60_000, max = 30, routeKey = "default" } = {}) {
  const resolvedWindowMs = Number.isInteger(Number(windowMs)) && Number(windowMs) >= 1_000
    ? Math.min(Number(windowMs), 24 * 60 * 60_000)
    : 60_000;
  const resolvedMax = Number.isInteger(Number(max)) && Number(max) >= 1
    ? Math.min(Number(max), 1_000_000)
    : 30;
  return async function rateLimitHook(request, reply) {
    const key = bucketKey(request, routeKey);
    const now = Date.now();
    operations += 1;
    if (operations % CLEANUP_EVERY === 0 || buckets.size >= MAX_BUCKETS) {
      for (const [bucketKeyValue, candidate] of buckets) {
        if (candidate.expiresAt <= now) buckets.delete(bucketKeyValue);
      }
      while (buckets.size >= MAX_BUCKETS) {
        const oldest = buckets.keys().next().value;
        if (oldest === undefined) break;
        buckets.delete(oldest);
      }
    }
    let bucket = buckets.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      bucket = { startedAt: now, expiresAt: now + resolvedWindowMs, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    const resetSeconds = Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000));
    reply.header("RateLimit-Limit", String(resolvedMax));
    reply.header("RateLimit-Remaining", String(Math.max(0, resolvedMax - bucket.count)));
    reply.header("RateLimit-Reset", String(resetSeconds));
    if (bucket.count > resolvedMax) {
      reply.header("Retry-After", String(resetSeconds));
      const error = Object.assign(new Error("Too many requests"), {
        statusCode: 429,
        code: "RATE_LIMITED"
      });
      throw error;
    }
  };
}

export function resetRateLimitersForTests() {
  buckets.clear();
  operations = 0;
}

export function getRateLimiterStats() {
  return { buckets: buckets.size, maxBuckets: MAX_BUCKETS };
}
