import { httpError } from "./api-errors.js";

const actorConnections = new Map();
const ipConnections = new Map();
let totalConnections = 0;

function boundedLimit(raw, fallback, maximum) {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value >= 1 && value <= maximum ? value : fallback;
}

export function resolveSseConnectionLimits(env = process.env) {
  return {
    perActor: boundedLimit(env.SSE_MAX_CONNECTIONS_PER_ACTOR, 8, 100),
    perIp: boundedLimit(env.SSE_MAX_CONNECTIONS_PER_IP, 64, 2_000),
    total: boundedLimit(env.SSE_MAX_CONNECTIONS_TOTAL, 2_000, 100_000)
  };
}

function requestIp(request) {
  return String(request.ip || request.socket?.remoteAddress || "unknown");
}

function increment(counter, key) {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

function decrement(counter, key) {
  const next = (counter.get(key) ?? 0) - 1;
  if (next > 0) counter.set(key, next);
  else counter.delete(key);
}

function connectionLimitError(scope) {
  return httpError(
    429,
    "Too many concurrent event streams. Close an existing page and retry.",
    "RATE_LIMITED",
    { scope: `sse_${scope}` }
  );
}

/**
 * Reserve one local SSE slot after authentication and authorization, but
 * before hijacking the HTTP response. Edge limits remain authoritative across
 * instances; this guard prevents one actor/IP from exhausting a Node process.
 */
export function acquireSseConnection(request, reply, env = process.env) {
  const limits = resolveSseConnectionLimits(env);
  const actorKey = String(request.actorId || "anonymous");
  const ipKey = requestIp(request);

  if (totalConnections >= limits.total) {
    reply?.header?.("Retry-After", "30");
    throw connectionLimitError("total");
  }
  if ((actorConnections.get(actorKey) ?? 0) >= limits.perActor) {
    reply?.header?.("Retry-After", "30");
    throw connectionLimitError("actor");
  }
  if ((ipConnections.get(ipKey) ?? 0) >= limits.perIp) {
    reply?.header?.("Retry-After", "30");
    throw connectionLimitError("ip");
  }

  totalConnections += 1;
  increment(actorConnections, actorKey);
  increment(ipConnections, ipKey);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    totalConnections = Math.max(0, totalConnections - 1);
    decrement(actorConnections, actorKey);
    decrement(ipConnections, ipKey);
  };
}

export function getSseConnectionGuardStats() {
  return {
    totalConnections,
    actors: actorConnections.size,
    ips: ipConnections.size
  };
}

export function resetSseConnectionGuardForTests() {
  actorConnections.clear();
  ipConnections.clear();
  totalConnections = 0;
}
