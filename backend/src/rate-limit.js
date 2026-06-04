/** In-memory sliding-window rate limiter (single-node). */

const buckets = new Map();

function bucketKey(request, routeKey) {
  const ip = request.ip || request.headers["x-forwarded-for"] || "unknown";
  return `${routeKey}:${ip}`;
}

export function createRateLimiter({ windowMs = 60_000, max = 30, routeKey = "default" } = {}) {
  return async function rateLimitHook(request, reply) {
    const key = bucketKey(request, routeKey);
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.startedAt > windowMs) {
      bucket = { startedAt: now, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      reply.header("Retry-After", String(Math.ceil(windowMs / 1000)));
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
}
