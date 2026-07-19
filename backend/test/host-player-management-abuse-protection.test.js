import assert from "node:assert/strict";
import test from "node:test";
import {
  createHostPlayerManagementAbuseProtection,
  resolveHostPlayerManagementRateLimits
} from "../src/host-player-management-abuse-protection.js";
import { resetRateLimitersForTests } from "../src/rate-limit.js";

function replyRecorder() {
  return { headers: {}, header(name, value) { this.headers[name] = value; return this; } };
}

function request({
  actorId = "host-1",
  ip = "10.0.0.1",
  method = "POST",
  action = "kick"
} = {}) {
  return {
    actorId,
    ip,
    method,
    url: `/api/rooms/room-1/host/players/role-1/${action}`,
    headers: {},
    socket: { remoteAddress: ip }
  };
}

test.afterEach(() => resetRateLimitersForTests());

test("host player management policy rejects unsafe environment values", () => {
  assert.deepEqual(resolveHostPlayerManagementRateLimits({
    RATE_LIMIT_HOST_PLAYER_NOTES_MAX: "0",
    RATE_LIMIT_HOST_PLAYER_NOTES_IP_MAX: "1000001",
    RATE_LIMIT_HOST_PLAYER_KICK_MAX: "-1",
    RATE_LIMIT_HOST_PLAYER_KICK_IP_MAX: "NaN"
  }), {
    notesActorPerMin: 30,
    notesIpPerMin: 120,
    kickActorPerMin: 10,
    kickIpPerMin: 60
  });
});

test("host notes and kick use independent actor buckets", async () => {
  const guard = createHostPlayerManagementAbuseProtection({
    RATE_LIMIT_HOST_PLAYER_NOTES_MAX: "1",
    RATE_LIMIT_HOST_PLAYER_NOTES_IP_MAX: "10",
    RATE_LIMIT_HOST_PLAYER_KICK_MAX: "1",
    RATE_LIMIT_HOST_PLAYER_KICK_IP_MAX: "10"
  });
  const reply = replyRecorder();
  await guard.protectActor(request({ method: "PUT", action: "notes" }), reply);
  await guard.protectActor(request(), reply);
  await assert.rejects(
    () => guard.protectActor(request(), reply),
    (error) => error.statusCode === 429 && error.code === "RATE_LIMITED"
  );
  await assert.rejects(
    () => guard.protectActor(request({ method: "PUT", action: "notes" }), reply),
    (error) => error.statusCode === 429 && error.code === "RATE_LIMITED"
  );
});

test("host player network bucket survives actor churn", async () => {
  const guard = createHostPlayerManagementAbuseProtection({
    RATE_LIMIT_HOST_PLAYER_KICK_MAX: "10",
    RATE_LIMIT_HOST_PLAYER_KICK_IP_MAX: "2"
  });
  const reply = replyRecorder();
  await guard.protectNetwork(request({ actorId: "host-1" }), reply);
  await guard.protectNetwork(request({ actorId: "host-2" }), reply);
  await assert.rejects(
    () => guard.protectNetwork(request({ actorId: "host-3" }), reply),
    (error) => error.statusCode === 429 && error.code === "RATE_LIMITED"
  );
});

test("host player guard ignores reads and unrelated writes", async () => {
  const guard = createHostPlayerManagementAbuseProtection({});
  const reply = replyRecorder();
  assert.equal(await guard.protectNetwork(request({ method: "GET" }), reply), false);
  assert.equal(await guard.protectActor(request({ action: "state" }), reply), false);
});
