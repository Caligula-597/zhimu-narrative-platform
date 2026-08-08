/** Bounded in-process fixed-window limiter (edge/WAF remains authoritative across instances). */

const buckets = new Map();
const MAX_BUCKETS = 20_000;
const CLEANUP_EVERY = 500;
let operations = 0;
let rejectedNewIdentities = 0;

function requestIp(request) {
  return request.ip || request.socket?.remoteAddress || "unknown";
}

function bucketKey(request, routeKey, identity) {
  if (identity === "ip") return `${routeKey}:ip:${requestIp(request)}`;
  if (identity === "verification-challenge") {
    if (request.actorId) return `${routeKey}:actor:${request.actorId}`;
    const challengeId = typeof request.body?.challengeId === "string"
      ? request.body.challengeId.trim()
      : "";
    return challengeId
      ? `${routeKey}:challenge:${challengeId}`
      : `${routeKey}:anonymous-ip:${requestIp(request)}`;
  }
  if (identity === "actor") {
    return request.actorId
      ? `${routeKey}:actor:${request.actorId}`
      : `${routeKey}:anonymous-ip:${requestIp(request)}`;
  }
  if (request.actorId) return `${routeKey}:actor:${request.actorId}`;
  return `${routeKey}:ip:${requestIp(request)}`;
}

function cleanupExpiredBuckets(now) {
  for (const [bucketKeyValue, candidate] of buckets) {
    if (candidate.expiresAt <= now) buckets.delete(bucketKeyValue);
  }
}

function rateLimitError() {
  return Object.assign(new Error("Too many requests"), {
    statusCode: 429,
    code: "RATE_LIMITED"
  });
}

export function createRateLimiter({
  windowMs = 60_000,
  max = 30,
  routeKey = "default",
  identity = "actor-or-ip"
} = {}) {
  const resolvedWindowMs = Number.isInteger(Number(windowMs)) && Number(windowMs) >= 1_000
    ? Math.min(Number(windowMs), 24 * 60 * 60_000)
    : 60_000;
  const resolvedMax = Number.isInteger(Number(max)) && Number(max) >= 1
    ? Math.min(Number(max), 1_000_000)
    : 30;
  const resolvedIdentity = ["actor", "ip", "actor-or-ip", "verification-challenge"].includes(identity)
    ? identity
    : "actor-or-ip";
  return async function rateLimitHook(request, reply) {
    const key = bucketKey(request, routeKey, resolvedIdentity);
    const now = Date.now();
    operations += 1;
    if (operations % CLEANUP_EVERY === 0) {
      cleanupExpiredBuckets(now);
    }
    let bucket = buckets.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      if (bucket) buckets.delete(key);
      // Never evict an active identity to admit a new one. Eviction lets an
      // attacker churn source identities and reset its own counters forever.
      if (buckets.size >= MAX_BUCKETS) {
        rejectedNewIdentities += 1;
        reply.header("RateLimit-Limit", String(resolvedMax));
        reply.header("RateLimit-Remaining", "0");
        reply.header("RateLimit-Reset", "1");
        reply.header("Retry-After", "1");
        throw rateLimitError();
      }
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
      throw rateLimitError();
    }
  };
}

export function resetRateLimitersForTests() {
  buckets.clear();
  operations = 0;
  rejectedNewIdentities = 0;
}

export function getRateLimiterStats() {
  return { buckets: buckets.size, maxBuckets: MAX_BUCKETS, rejectedNewIdentities };
}
