import assert from "node:assert/strict";
import test from "node:test";
import {
  createHostCommunicationAbuseProtection,
  resolveHostCommunicationRateLimits
} from "../src/host-communication-abuse-protection.js";
import { resetRateLimitersForTests } from "../src/rate-limit.js";

function replyRecorder() {
  return { headers: {}, header(name, value) { this.headers[name] = value; return this; } };
}

function request({
  actorId = "host-1",
  ip = "10.0.0.1",
  method = "POST",
  suffix = "/host/nudge-waiting"
} = {}) {
  return {
    actorId,
    ip,
    method,
    url: `/api/rooms/room-1${suffix}`,
    headers: {},
    socket: { remoteAddress: ip }
  };
}

test.afterEach(() => resetRateLimitersForTests());

test("host communication policy rejects unsafe environment values", () => {
  assert.deepEqual(resolveHostCommunicationRateLimits({
    RATE_LIMIT_HOST_LOG_MAX: "0",
    RATE_LIMIT_HOST_LOG_IP_MAX: "1000001",
    RATE_LIMIT_HOST_NUDGE_MAX: "-1",
    RATE_LIMIT_HOST_NUDGE_IP_MAX: "NaN"
  }), {
    logActorPerMin: 30,
    logIpPerMin: 120,
    nudgeActorPerMin: 10,
    nudgeIpPerMin: 60
  });
});

test("host log and nudge use independent actor buckets", async () => {
  const guard = createHostCommunicationAbuseProtection({
    RATE_LIMIT_HOST_LOG_MAX: "1",
    RATE_LIMIT_HOST_LOG_IP_MAX: "10",
    RATE_LIMIT_HOST_NUDGE_MAX: "1",
    RATE_LIMIT_HOST_NUDGE_IP_MAX: "10"
  });
  const reply = replyRecorder();
  await guard.protectActor(request({ suffix: "/host/log" }), reply);
  await guard.protectActor(request(), reply);
  await assert.rejects(
    () => guard.protectActor(request(), reply),
    (error) => error.statusCode === 429 && error.code === "RATE_LIMITED"
  );
  await assert.rejects(
    () => guard.protectActor(request({ suffix: "/host/log" }), reply),
    (error) => error.statusCode === 429 && error.code === "RATE_LIMITED"
  );
});

test("host communication network buckets cannot be bypassed by actor churn", async () => {
  const guard = createHostCommunicationAbuseProtection({
    RATE_LIMIT_HOST_NUDGE_MAX: "10",
    RATE_LIMIT_HOST_NUDGE_IP_MAX: "2"
  });
  const reply = replyRecorder();
  await guard.protectNetwork(request({ actorId: "host-1" }), reply);
  await guard.protectNetwork(request({ actorId: "host-2" }), reply);
  await assert.rejects(
    () => guard.protectNetwork(request({ actorId: "host-3" }), reply),
    (error) => error.statusCode === 429 && error.code === "RATE_LIMITED"
  );
});

test("host communication guard ignores reads and unrelated writes", async () => {
  const guard = createHostCommunicationAbuseProtection({});
  const reply = replyRecorder();
  assert.equal(await guard.protectNetwork(request({ method: "GET" }), reply), false);
  assert.equal(await guard.protectActor(request({ suffix: "/host/grant-clue" }), reply), false);
});
