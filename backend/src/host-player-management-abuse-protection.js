import { createRateLimiter } from "./rate-limit.js";

const ONE_MINUTE = 60_000;

function boundedLimit(raw, fallback) {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value >= 1 && value <= 1_000_000 ? value : fallback;
}

export function resolveHostPlayerManagementRateLimits(env = process.env) {
  return {
    notesActorPerMin: boundedLimit(env.RATE_LIMIT_HOST_PLAYER_NOTES_MAX, 30),
    notesIpPerMin: boundedLimit(env.RATE_LIMIT_HOST_PLAYER_NOTES_IP_MAX, 120),
    kickActorPerMin: boundedLimit(env.RATE_LIMIT_HOST_PLAYER_KICK_MAX, 10),
    kickIpPerMin: boundedLimit(env.RATE_LIMIT_HOST_PLAYER_KICK_IP_MAX, 60)
  };
}

export function createHostPlayerManagementAbuseProtection(env = process.env) {
  const policy = resolveHostPlayerManagementRateLimits(env);
  const guards = {
    notes: {
      actor: createRateLimiter({ windowMs: ONE_MINUTE, max: policy.notesActorPerMin, routeKey: "host-player-notes-actor", identity: "actor" }),
      ip: createRateLimiter({ windowMs: ONE_MINUTE, max: policy.notesIpPerMin, routeKey: "host-player-notes-ip", identity: "ip" })
    },
    kick: {
      actor: createRateLimiter({ windowMs: ONE_MINUTE, max: policy.kickActorPerMin, routeKey: "host-player-kick-actor", identity: "actor" }),
      ip: createRateLimiter({ windowMs: ONE_MINUTE, max: policy.kickIpPerMin, routeKey: "host-player-kick-ip", identity: "ip" })
    }
  };

  function routeKind(request, url) {
    if (request.method === "PUT" && /^\/api\/rooms\/[^/]+\/host\/players\/[^/]+\/notes$/.test(url)) return "notes";
    if (request.method === "POST" && /^\/api\/rooms\/[^/]+\/host\/players\/[^/]+\/kick$/.test(url)) return "kick";
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
