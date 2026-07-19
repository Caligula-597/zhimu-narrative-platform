import { createRateLimiter } from "./rate-limit.js";

const ONE_MINUTE = 60_000;

function boundedLimit(raw, fallback) {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value >= 1 && value <= 1_000_000 ? value : fallback;
}

export function resolveHostCommunicationRateLimits(env = process.env) {
  return {
    logActorPerMin: boundedLimit(env.RATE_LIMIT_HOST_LOG_MAX, 30),
    logIpPerMin: boundedLimit(env.RATE_LIMIT_HOST_LOG_IP_MAX, 120),
    nudgeActorPerMin: boundedLimit(env.RATE_LIMIT_HOST_NUDGE_MAX, 10),
    nudgeIpPerMin: boundedLimit(env.RATE_LIMIT_HOST_NUDGE_IP_MAX, 60)
  };
}

export function createHostCommunicationAbuseProtection(env = process.env) {
  const policy = resolveHostCommunicationRateLimits(env);
  const guards = {
    log: {
      actor: createRateLimiter({ windowMs: ONE_MINUTE, max: policy.logActorPerMin, routeKey: "host-log-actor", identity: "actor" }),
      ip: createRateLimiter({ windowMs: ONE_MINUTE, max: policy.logIpPerMin, routeKey: "host-log-ip", identity: "ip" })
    },
    nudge: {
      actor: createRateLimiter({ windowMs: ONE_MINUTE, max: policy.nudgeActorPerMin, routeKey: "host-nudge-actor", identity: "actor" }),
      ip: createRateLimiter({ windowMs: ONE_MINUTE, max: policy.nudgeIpPerMin, routeKey: "host-nudge-ip", identity: "ip" })
    }
  };

  function routeKind(request, url) {
    if (request.method !== "POST") return null;
    if (/^\/api\/rooms\/[^/]+\/host\/log$/.test(url)) return "log";
    if (/^\/api\/rooms\/[^/]+\/host\/nudge-waiting$/.test(url)) return "nudge";
    return null;
  }

  async function protectNetwork(request, reply, url = request.url.split("?")[0]) {
    const kind = routeKind(request, url);
    if (!kind) return false;
    await guards[kind].ip(request, reply);
    return true;
  }

  async function protectActor(request, reply, url = request.url.split("?")[0]) {
    const kind = routeKind(request, url);
    if (!kind) return false;
    await guards[kind].actor(request, reply);
    return true;
  }

  return { policy, protectNetwork, protectActor };
}
