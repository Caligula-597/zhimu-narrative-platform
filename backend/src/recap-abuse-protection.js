import { createRateLimiter } from "./rate-limit.js";

const ONE_MINUTE = 60_000;

function boundedLimit(raw, fallback) {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value >= 1 && value <= 1_000_000 ? value : fallback;
}

export function resolveRecapRateLimits(env = process.env) {
  return {
    createActorPerMin: boundedLimit(env.RATE_LIMIT_RECAP_CREATE_MAX, 2),
    createIpPerMin: boundedLimit(env.RATE_LIMIT_RECAP_CREATE_IP_MAX, 20)
  };
}

export function createRecapAbuseProtection(env = process.env) {
  const policy = resolveRecapRateLimits(env);
  const actor = createRateLimiter({
    windowMs: ONE_MINUTE,
    max: policy.createActorPerMin,
    routeKey: "recap-create-actor",
    identity: "actor"
  });
  const ip = createRateLimiter({
    windowMs: ONE_MINUTE,
    max: policy.createIpPerMin,
    routeKey: "recap-create-ip",
    identity: "ip"
  });

  function matches(request, url) {
    return request.method === "POST" && /^\/api\/rooms\/[^/]+\/recaps$/.test(url);
  }

  async function protectNetwork(request, reply, url = request.url.split("?")[0]) {
    if (!matches(request, url)) return false;
    await ip(request, reply);
    return true;
  }

  async function protectActor(request, reply, url = request.url.split("?")[0]) {
    if (!matches(request, url)) return false;
    await actor(request, reply);
    return true;
  }

  return { policy, protectNetwork, protectActor };
}
