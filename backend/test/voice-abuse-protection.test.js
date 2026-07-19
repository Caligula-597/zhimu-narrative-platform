import assert from "node:assert/strict";
import test from "node:test";
import {
  createVoiceAbuseProtection,
  resolveVoiceRateLimits
} from "../src/voice-abuse-protection.js";
import { resetRateLimitersForTests } from "../src/rate-limit.js";

function replyRecorder() {
  const headers = {};
  return {
    headers,
    header(name, value) {
      headers[name] = value;
    }
  };
}

function request({
  actorId = "actor-a",
  ip = "10.0.0.1",
  method = "POST",
  url = "/api/voice-rooms/not-a-uuid/messages"
} = {}) {
  return { actorId, ip, method, url, headers: {}, socket: { remoteAddress: ip } };
}

test.afterEach(() => resetRateLimitersForTests());

test("voice policy falls back when environment values are invalid", () => {
  const policy = resolveVoiceRateLimits({
    RATE_LIMIT_VOICE_READ_MAX: "0",
    RATE_LIMIT_VOICE_MESSAGE_MAX: "NaN",
    RATE_LIMIT_VOICE_TOKEN_IP_MAX: "1000001",
    RATE_LIMIT_VOICE_CREATE_MAX: "-1"
  });
  assert.equal(policy.readActorPerMin, 120);
  assert.equal(policy.messageActorPerMin, 20);
  assert.equal(policy.tokenIpPerMin, 120);
  assert.equal(policy.createActorPerMin, 5);
});

test("voice message flood is capped independently by actor and network", async () => {
  const guard = createVoiceAbuseProtection({
    RATE_LIMIT_VOICE_MESSAGE_MAX: "2",
    RATE_LIMIT_VOICE_MESSAGE_IP_MAX: "3"
  });
  const reply = replyRecorder();
  await guard.protect(request({ actorId: "a" }), reply);
  await guard.protect(request({ actorId: "b" }), reply);
  await guard.protect(request({ actorId: "c" }), reply);
  await assert.rejects(
    () => guard.protect(request({ actorId: "d" }), reply),
    (error) => error.code === "RATE_LIMITED"
  );

  resetRateLimitersForTests();
  const actorGuard = createVoiceAbuseProtection({
    RATE_LIMIT_VOICE_MESSAGE_MAX: "1",
    RATE_LIMIT_VOICE_MESSAGE_IP_MAX: "100"
  });
  await actorGuard.protect(request({ actorId: "same", ip: "10.0.0.1" }), reply);
  await assert.rejects(
    () => actorGuard.protect(request({ actorId: "same", ip: "10.0.0.2" }), reply),
    (error) => error.code === "RATE_LIMITED"
  );
});

test("token, create, invite, message, and read routes use separate buckets", async () => {
  const guard = createVoiceAbuseProtection({
    RATE_LIMIT_VOICE_READ_MAX: "1",
    RATE_LIMIT_VOICE_READ_IP_MAX: "100",
    RATE_LIMIT_VOICE_MESSAGE_MAX: "1",
    RATE_LIMIT_VOICE_MESSAGE_IP_MAX: "100",
    RATE_LIMIT_VOICE_TOKEN_MAX: "1",
    RATE_LIMIT_VOICE_TOKEN_IP_MAX: "100",
    RATE_LIMIT_VOICE_CREATE_MAX: "1",
    RATE_LIMIT_VOICE_CREATE_IP_MAX: "100",
    RATE_LIMIT_VOICE_INVITE_MAX: "1",
    RATE_LIMIT_VOICE_INVITE_IP_MAX: "100"
  });
  const reply = replyRecorder();
  const routes = [
    request({ method: "GET", url: "/api/voice-rooms/x/messages" }),
    request({ method: "POST", url: "/api/voice-rooms/x/messages" }),
    request({ method: "POST", url: "/api/rooms/r/voice-rooms/v/token" }),
    request({ method: "POST", url: "/api/rooms/r/voice-rooms" }),
    request({ method: "POST", url: "/api/voice-rooms/v/members" })
  ];
  for (const route of routes) {
    assert.equal(await guard.protect(route, reply), true);
    await assert.rejects(() => guard.protect(route, reply), (error) => error.code === "RATE_LIMITED");
  }
  assert.equal(await guard.protect(request({ method: "GET", url: "/api/rooms/r/player-home" }), reply), false);
});

test("network admission counts malformed voice identifiers before schema validation", async () => {
  const guard = createVoiceAbuseProtection({
    RATE_LIMIT_VOICE_TOKEN_MAX: "100",
    RATE_LIMIT_VOICE_TOKEN_IP_MAX: "1"
  });
  const reply = replyRecorder();
  const malformed = request({
    actorId: null,
    method: "POST",
    url: "/api/rooms/not-a-uuid/voice-rooms/not-a-uuid/token"
  });
  assert.equal(await guard.protectNetwork(malformed, reply), true);
  await assert.rejects(
    () => guard.protectNetwork(malformed, reply),
    (error) => error.code === "RATE_LIMITED"
  );
});
