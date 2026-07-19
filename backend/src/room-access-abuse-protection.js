import { createRateLimiter } from "./rate-limit.js";

const ONE_MINUTE = 60_000;

function boundedLimit(raw, fallback) {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value >= 1 && value <= 1_000_000 ? value : fallback;
}

export function resolveRoomAccessRateLimits(env = process.env) {
  return {
    inviteLookupActorPerMin: boundedLimit(env.RATE_LIMIT_INVITE_LOOKUP_MAX, 30),
    inviteLookupIpPerMin: boundedLimit(env.RATE_LIMIT_INVITE_LOOKUP_IP_MAX, 120),
    roomJoinActorPerMin: boundedLimit(env.RATE_LIMIT_ROOM_JOIN_MAX, 12),
    roomJoinIpPerMin: boundedLimit(env.RATE_LIMIT_ROOM_JOIN_IP_MAX, 80)
  };
}

export function createRoomAccessAbuseProtection(env = process.env) {
  const policy = resolveRoomAccessRateLimits(env);
  const inviteLookupIp = createRateLimiter({
    windowMs: ONE_MINUTE,
    max: policy.inviteLookupIpPerMin,
    routeKey: "room-invite-lookup-ip",
    identity: "ip"
  });
  const inviteLookupActor = createRateLimiter({
    windowMs: ONE_MINUTE,
    max: policy.inviteLookupActorPerMin,
    routeKey: "room-invite-lookup-actor",
    identity: "actor"
  });
  const roomJoinIp = createRateLimiter({
    windowMs: ONE_MINUTE,
    max: policy.roomJoinIpPerMin,
    routeKey: "room-join-ip",
    identity: "ip"
  });
  const roomJoinActor = createRateLimiter({
    windowMs: ONE_MINUTE,
    max: policy.roomJoinActorPerMin,
    routeKey: "room-join-actor",
    identity: "actor"
  });

  function routeKind(request, url) {
    if (request.method === "GET" && /^\/api\/rooms\/invite\/[^/]+$/.test(url)) return "lookup";
    if (request.method === "POST" && url === "/api/rooms/join") return "join";
    return null;
  }

  async function protectNetwork(request, reply, url = request.url.split("?")[0]) {
    const kind = routeKind(request, url);
    if (kind === "lookup") await inviteLookupIp(request, reply);
    if (kind === "join") await roomJoinIp(request, reply);
    return Boolean(kind);
  }

  async function protectActor(request, reply, url = request.url.split("?")[0]) {
    const kind = routeKind(request, url);
    if (kind === "lookup") await inviteLookupActor(request, reply);
    if (kind === "join") await roomJoinActor(request, reply);
    return Boolean(kind);
  }

  return {
    policy,
    protectNetwork,
    protectActor,
    async protect(request, reply, url = request.url.split("?")[0]) {
      // Network admission runs first so account rotation cannot bypass the
      // actor bucket. The app invokes this half at onRequest to count malformed
      // payloads before schema validation; the combined helper remains useful
      // for isolated tests and non-Fastify consumers.
      if (!await protectNetwork(request, reply, url)) return false;
      await protectActor(request, reply, url);
      return true;
    }
  };
}
