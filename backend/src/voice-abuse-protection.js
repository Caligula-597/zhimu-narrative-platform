import { createRateLimiter } from "./rate-limit.js";

const ONE_MINUTE = 60_000;

function boundedLimit(raw, fallback) {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value >= 1 && value <= 1_000_000 ? value : fallback;
}

export function resolveVoiceRateLimits(env = process.env) {
  return {
    readActorPerMin: boundedLimit(env.RATE_LIMIT_VOICE_READ_MAX, 120),
    readIpPerMin: boundedLimit(env.RATE_LIMIT_VOICE_READ_IP_MAX, 600),
    messageActorPerMin: boundedLimit(env.RATE_LIMIT_VOICE_MESSAGE_MAX, 20),
    messageIpPerMin: boundedLimit(env.RATE_LIMIT_VOICE_MESSAGE_IP_MAX, 240),
    tokenActorPerMin: boundedLimit(env.RATE_LIMIT_VOICE_TOKEN_MAX, 10),
    tokenIpPerMin: boundedLimit(env.RATE_LIMIT_VOICE_TOKEN_IP_MAX, 120),
    createActorPerMin: boundedLimit(env.RATE_LIMIT_VOICE_CREATE_MAX, 5),
    createIpPerMin: boundedLimit(env.RATE_LIMIT_VOICE_CREATE_IP_MAX, 60),
    inviteActorPerMin: boundedLimit(env.RATE_LIMIT_VOICE_INVITE_MAX, 10),
    inviteIpPerMin: boundedLimit(env.RATE_LIMIT_VOICE_INVITE_IP_MAX, 120)
  };
}

export function createVoiceAbuseProtection(env = process.env) {
  const policy = resolveVoiceRateLimits(env);
  const routePolicies = Object.fromEntries(
    [
      ["read", policy.readActorPerMin, policy.readIpPerMin],
      ["message", policy.messageActorPerMin, policy.messageIpPerMin],
      ["token", policy.tokenActorPerMin, policy.tokenIpPerMin],
      ["create", policy.createActorPerMin, policy.createIpPerMin],
      ["invite", policy.inviteActorPerMin, policy.inviteIpPerMin]
    ].map(([kind, actorMax, ipMax]) => [kind, {
      actor: createRateLimiter({
        windowMs: ONE_MINUTE,
        max: actorMax,
        routeKey: `voice-${kind}-actor`,
        identity: "actor"
      }),
      ip: createRateLimiter({
        windowMs: ONE_MINUTE,
        max: ipMax,
        routeKey: `voice-${kind}-ip`,
        identity: "ip"
      })
    }])
  );

  function routeKind(request, url) {
    if (request.method === "GET" && /^\/api\/voice-rooms\/[^/]+\/messages$/.test(url)) return "read";
    if (request.method === "POST" && /^\/api\/voice-rooms\/[^/]+\/messages$/.test(url)) return "message";
    if (request.method === "POST" && /^\/api\/voice-rooms\/[^/]+\/members$/.test(url)) return "invite";
    if (request.method !== "POST") return null;
    if (/^\/api\/rooms\/[^/]+\/voice-rooms\/[^/]+\/token$/.test(url)) return "token";
    if (/^\/api\/rooms\/[^/]+\/voice-rooms$/.test(url)) return "create";
    return null;
  }

  async function protectNetwork(request, reply, url = request.url.split("?")[0]) {
    const kind = routeKind(request, url);
    if (kind) await routePolicies[kind].ip(request, reply);
    return Boolean(kind);
  }

  async function protectActor(request, reply, url = request.url.split("?")[0]) {
    const kind = routeKind(request, url);
    if (kind) await routePolicies[kind].actor(request, reply);
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
