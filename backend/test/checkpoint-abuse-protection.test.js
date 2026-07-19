import assert from "node:assert/strict";
import test from "node:test";
import {
  createCheckpointAbuseProtection,
  resolveCheckpointRateLimits
} from "../src/checkpoint-abuse-protection.js";
import { resetRateLimitersForTests } from "../src/rate-limit.js";

function replyRecorder() {
  return { headers: {}, header(name, value) { this.headers[name] = value; return this; } };
}

function request({
  actorId = "host-1",
  ip = "10.0.0.1",
  method = "POST",
  url = "/api/rooms/room-1/checkpoints"
} = {}) {
  return { actorId, ip, method, url, headers: {}, socket: { remoteAddress: ip } };
}

test.afterEach(() => resetRateLimitersForTests());

test("checkpoint policy falls back when environment values are invalid", () => {
  assert.deepEqual(resolveCheckpointRateLimits({
    RATE_LIMIT_CHECKPOINT_CREATE_MAX: "0",
    RATE_LIMIT_CHECKPOINT_CREATE_IP_MAX: "NaN",
    RATE_LIMIT_CHECKPOINT_RESTORE_MAX: "-1",
    RATE_LIMIT_CHECKPOINT_RESTORE_IP_MAX: "1000001"
  }), {
    createActorPerMin: 5,
    createIpPerMin: 30,
    restoreActorPerMin: 3,
    restoreIpPerMin: 20
  });
});

test("checkpoint create and restore use separate tight actor buckets", async () => {
  const guard = createCheckpointAbuseProtection({
    RATE_LIMIT_CHECKPOINT_CREATE_MAX: "1",
    RATE_LIMIT_CHECKPOINT_CREATE_IP_MAX: "100",
    RATE_LIMIT_CHECKPOINT_RESTORE_MAX: "1",
    RATE_LIMIT_CHECKPOINT_RESTORE_IP_MAX: "100"
  });
  const reply = replyRecorder();
  const create = request();
  const restore = request({ url: "/api/rooms/room-1/checkpoints/checkpoint-1/restore" });

  await guard.protect(create, reply);
  await guard.protect(restore, reply);
  await assert.rejects(() => guard.protect(create, reply), (error) => error.statusCode === 429);
  await assert.rejects(() => guard.protect(restore, reply), (error) => error.statusCode === 429);
});

test("checkpoint network bucket counts requests before actor resolution", async () => {
  const guard = createCheckpointAbuseProtection({
    RATE_LIMIT_CHECKPOINT_CREATE_MAX: "100",
    RATE_LIMIT_CHECKPOINT_CREATE_IP_MAX: "1"
  });
  const reply = replyRecorder();
  const anonymous = request({ actorId: null });
  await guard.protectNetwork(anonymous, reply);
  await assert.rejects(
    () => guard.protectNetwork(anonymous, reply),
    (error) => error.statusCode === 429 && error.code === "RATE_LIMITED"
  );
});

test("checkpoint guard ignores reads and unrelated writes", async () => {
  const guard = createCheckpointAbuseProtection({});
  const reply = replyRecorder();
  assert.equal(await guard.protect(request({ method: "GET" }), reply), false);
  assert.equal(await guard.protect(request({ url: "/api/rooms/room-1/recaps" }), reply), false);
});
