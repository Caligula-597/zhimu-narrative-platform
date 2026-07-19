import { createRateLimiter } from "./rate-limit.js";

const ONE_MINUTE = 60_000;

function boundedLimit(raw, fallback) {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value >= 1 && value <= 1_000_000 ? value : fallback;
}

export function resolveCheckpointRateLimits(env = process.env) {
  return {
    createActorPerMin: boundedLimit(env.RATE_LIMIT_CHECKPOINT_CREATE_MAX, 5),
    createIpPerMin: boundedLimit(env.RATE_LIMIT_CHECKPOINT_CREATE_IP_MAX, 30),
    restoreActorPerMin: boundedLimit(env.RATE_LIMIT_CHECKPOINT_RESTORE_MAX, 3),
    restoreIpPerMin: boundedLimit(env.RATE_LIMIT_CHECKPOINT_RESTORE_IP_MAX, 20)
  };
}

export function createCheckpointAbuseProtection(env = process.env) {
  const policy = resolveCheckpointRateLimits(env);
  const policies = Object.fromEntries([
    ["create", policy.createActorPerMin, policy.createIpPerMin],
    ["restore", policy.restoreActorPerMin, policy.restoreIpPerMin]
  ].map(([kind, actorMax, ipMax]) => [kind, {
    actor: createRateLimiter({
      windowMs: ONE_MINUTE,
      max: actorMax,
      routeKey: `checkpoint-${kind}-actor`,
      identity: "actor"
    }),
    ip: createRateLimiter({
      windowMs: ONE_MINUTE,
      max: ipMax,
      routeKey: `checkpoint-${kind}-ip`,
      identity: "ip"
    })
  }]));

  function routeKind(request, url) {
    if (request.method !== "POST") return null;
    if (/^\/api\/rooms\/[^/]+\/checkpoints\/[^/]+\/restore$/.test(url)) return "restore";
    if (/^\/api\/rooms\/[^/]+\/checkpoints$/.test(url)) return "create";
    return null;
  }

  async function protectNetwork(request, reply, url = request.url.split("?")[0]) {
    const kind = routeKind(request, url);
    if (kind) await policies[kind].ip(request, reply);
    return Boolean(kind);
  }

  async function protectActor(request, reply, url = request.url.split("?")[0]) {
    const kind = routeKind(request, url);
    if (kind) await policies[kind].actor(request, reply);
    return Boolean(kind);
  }

  return {
    policy,
    protectNetwork,
    protectActor,
    async protect(request, reply, url = request.url.split("?")[0]) {
      if (!await protectNetwork(request, reply, url)) return false;
      await protectActor(request, reply, url);
      return true;
    }
  };
}
