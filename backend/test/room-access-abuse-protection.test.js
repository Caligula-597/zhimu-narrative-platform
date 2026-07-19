import assert from "node:assert/strict";
import test from "node:test";
import {
  createRoomAccessAbuseProtection,
  resolveRoomAccessRateLimits
} from "../src/room-access-abuse-protection.js";
import {
  createRateLimiter,
  getRateLimiterStats,
  resetRateLimitersForTests
} from "../src/rate-limit.js";

function replyRecorder() {
  const headers = {};
  return {
    headers,
    header(name, value) {
      headers[name] = value;
    }
  };
}

function request({ actorId, ip, method = "GET", url = "/api/rooms/invite/INVALID" }) {
  return { actorId, ip, method, url, headers: {}, socket: { remoteAddress: ip } };
}

test.afterEach(() => resetRateLimitersForTests());

test("room access policy rejects invalid environment values", () => {
  assert.deepEqual(resolveRoomAccessRateLimits({
    RATE_LIMIT_INVITE_LOOKUP_MAX: "NaN",
    RATE_LIMIT_INVITE_LOOKUP_IP_MAX: "0",
    RATE_LIMIT_ROOM_JOIN_MAX: "-1",
    RATE_LIMIT_ROOM_JOIN_IP_MAX: "1000001"
  }), {
    inviteLookupActorPerMin: 30,
    inviteLookupIpPerMin: 120,
    roomJoinActorPerMin: 12,
    roomJoinIpPerMin: 80
  });
});

test("invite lookup is capped independently by actor and network", async () => {
  const guard = createRoomAccessAbuseProtection({
    RATE_LIMIT_INVITE_LOOKUP_MAX: "2",
    RATE_LIMIT_INVITE_LOOKUP_IP_MAX: "3"
  });
  const reply = replyRecorder();

  await guard.protect(request({ actorId: "actor-a", ip: "10.0.0.1" }), reply);
  await guard.protect(request({ actorId: "actor-b", ip: "10.0.0.1" }), reply);
  await guard.protect(request({ actorId: "actor-c", ip: "10.0.0.1" }), reply);
  await assert.rejects(
    () => guard.protect(request({ actorId: "actor-d", ip: "10.0.0.1" }), reply),
    (error) => error.code === "RATE_LIMITED"
  );

  resetRateLimitersForTests();
  const actorGuard = createRoomAccessAbuseProtection({
    RATE_LIMIT_INVITE_LOOKUP_MAX: "2",
    RATE_LIMIT_INVITE_LOOKUP_IP_MAX: "100"
  });
  await actorGuard.protect(request({ actorId: "actor-a", ip: "10.0.0.1" }), reply);
  await actorGuard.protect(request({ actorId: "actor-a", ip: "10.0.0.2" }), reply);
  await assert.rejects(
    () => actorGuard.protect(request({ actorId: "actor-a", ip: "10.0.0.3" }), reply),
    (error) => error.code === "RATE_LIMITED"
  );
});

test("join attempts use a tighter bucket and unrelated routes are ignored", async () => {
  const guard = createRoomAccessAbuseProtection({
    RATE_LIMIT_ROOM_JOIN_MAX: "1",
    RATE_LIMIT_ROOM_JOIN_IP_MAX: "10"
  });
  const reply = replyRecorder();
  const join = request({ actorId: "actor-a", ip: "10.0.0.1", method: "POST", url: "/api/rooms/join" });

  assert.equal(await guard.protect(join, reply), true);
  await assert.rejects(() => guard.protect(join, reply), (error) => error.code === "RATE_LIMITED");
  assert.equal(await guard.protect(request({
    actorId: "actor-a",
    ip: "10.0.0.1",
    method: "GET",
    url: "/api/rooms/room-1/player-home"
  }), reply), false);
});

test("network admission counts malformed joins before actor resolution", async () => {
  const guard = createRoomAccessAbuseProtection({
    RATE_LIMIT_ROOM_JOIN_MAX: "100",
    RATE_LIMIT_ROOM_JOIN_IP_MAX: "1"
  });
  const reply = replyRecorder();
  const malformed = request({ actorId: null, ip: "10.0.0.9", method: "POST", url: "/api/rooms/join" });
  assert.equal(await guard.protectNetwork(malformed, reply), true);
  await assert.rejects(
    () => guard.protectNetwork(malformed, reply),
    (error) => error.code === "RATE_LIMITED"
  );
});

test("limiter fails closed instead of evicting active identities at capacity", async () => {
  const limiter = createRateLimiter({
    windowMs: 60_000,
    max: 2,
    routeKey: "capacity",
    identity: "ip"
  });
  const reply = replyRecorder();
  const { maxBuckets } = getRateLimiterStats();
  for (let index = 0; index < maxBuckets; index += 1) {
    await limiter(request({ actorId: null, ip: `198.51.${Math.floor(index / 256)}.${index % 256}` }), reply);
  }

  await assert.rejects(
    () => limiter(request({ actorId: null, ip: "203.0.113.250" }), reply),
    (error) => error.code === "RATE_LIMITED"
  );
  assert.deepEqual(getRateLimiterStats(), {
    buckets: maxBuckets,
    maxBuckets,
    rejectedNewIdentities: 1
  });
  // Existing identities retain their counters and remain serviceable.
  await limiter(request({ actorId: null, ip: "198.51.0.0" }), reply);
});
