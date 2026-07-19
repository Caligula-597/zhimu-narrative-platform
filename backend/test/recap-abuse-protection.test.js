import assert from "node:assert/strict";
import test from "node:test";
import {
  createRecapAbuseProtection,
  resolveRecapRateLimits
} from "../src/recap-abuse-protection.js";
import { resetRateLimitersForTests } from "../src/rate-limit.js";

function replyRecorder() {
  return { headers: {}, header(name, value) { this.headers[name] = value; return this; } };
}

function request({ actorId = "host-1", ip = "10.0.0.1", method = "POST", url = "/api/rooms/room-1/recaps" } = {}) {
  return { actorId, ip, method, url, headers: {}, socket: { remoteAddress: ip } };
}

test.afterEach(() => resetRateLimitersForTests());

test("recap policy falls back when environment values are invalid", () => {
  assert.deepEqual(resolveRecapRateLimits({
    RATE_LIMIT_RECAP_CREATE_MAX: "0",
    RATE_LIMIT_RECAP_CREATE_IP_MAX: "1000001"
  }), { createActorPerMin: 2, createIpPerMin: 20 });
});

test("recap creation has separate actor and network buckets", async () => {
  const guard = createRecapAbuseProtection({
    RATE_LIMIT_RECAP_CREATE_MAX: "1",
    RATE_LIMIT_RECAP_CREATE_IP_MAX: "2"
  });
  const reply = replyRecorder();
  await guard.protectNetwork(request(), reply);
  await guard.protectActor(request(), reply);
  await assert.rejects(
    () => guard.protectActor(request(), reply),
    (error) => error.statusCode === 429 && error.code === "RATE_LIMITED"
  );
  await guard.protectNetwork(request({ actorId: "host-2" }), reply);
  await assert.rejects(
    () => guard.protectNetwork(request({ actorId: "host-3" }), reply),
    (error) => error.statusCode === 429 && error.code === "RATE_LIMITED"
  );
});

test("recap guard ignores reads and unrelated writes", async () => {
  const guard = createRecapAbuseProtection({});
  const reply = replyRecorder();
  assert.equal(await guard.protectNetwork(request({ method: "GET" }), reply), false);
  assert.equal(await guard.protectActor(request({ url: "/api/rooms/room-1/checkpoints" }), reply), false);
});
