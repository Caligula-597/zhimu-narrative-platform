import assert from "node:assert/strict";
import test from "node:test";
import {
  acquireSseConnection,
  getSseConnectionGuardStats,
  resetSseConnectionGuardForTests,
  resolveSseConnectionLimits
} from "../src/sse-connection-guard.js";

function request(actorId, ip) {
  return { actorId, ip, socket: { remoteAddress: ip } };
}

function reply() {
  return {
    headers: {},
    header(name, value) {
      this.headers[name] = value;
    }
  };
}

test.beforeEach(() => resetSseConnectionGuardForTests());
test.after(() => resetSseConnectionGuardForTests());

test("SSE connection limits reject unsafe environment overrides", () => {
  assert.deepEqual(resolveSseConnectionLimits({}), {
    perActor: 8,
    perIp: 64,
    total: 2_000
  });
  assert.deepEqual(resolveSseConnectionLimits({
    SSE_MAX_CONNECTIONS_PER_ACTOR: "0",
    SSE_MAX_CONNECTIONS_PER_IP: "2001",
    SSE_MAX_CONNECTIONS_TOTAL: "100001"
  }), {
    perActor: 8,
    perIp: 64,
    total: 2_000
  });
});

test("SSE guard caps one actor and releases leases idempotently", () => {
  const env = {
    SSE_MAX_CONNECTIONS_PER_ACTOR: "2",
    SSE_MAX_CONNECTIONS_PER_IP: "5",
    SSE_MAX_CONNECTIONS_TOTAL: "5"
  };
  const first = acquireSseConnection(request("actor-a", "203.0.113.1"), reply(), env);
  const second = acquireSseConnection(request("actor-a", "203.0.113.1"), reply(), env);
  const rejectedReply = reply();

  assert.throws(
    () => acquireSseConnection(request("actor-a", "203.0.113.1"), rejectedReply, env),
    (error) => error.statusCode === 429
      && error.code === "RATE_LIMITED"
      && error.details?.scope === "sse_actor"
  );
  assert.equal(rejectedReply.headers["Retry-After"], "30");
  assert.equal(getSseConnectionGuardStats().totalConnections, 2);

  first();
  first();
  assert.equal(getSseConnectionGuardStats().totalConnections, 1);
  const replacement = acquireSseConnection(request("actor-a", "203.0.113.1"), reply(), env);
  replacement();
  second();
  assert.deepEqual(getSseConnectionGuardStats(), { totalConnections: 0, actors: 0, ips: 0 });
});

test("SSE guard caps shared IP and total process connections independently", () => {
  const ipEnv = {
    SSE_MAX_CONNECTIONS_PER_ACTOR: "5",
    SSE_MAX_CONNECTIONS_PER_IP: "2",
    SSE_MAX_CONNECTIONS_TOTAL: "5"
  };
  const leases = [
    acquireSseConnection(request("actor-a", "203.0.113.2"), reply(), ipEnv),
    acquireSseConnection(request("actor-b", "203.0.113.2"), reply(), ipEnv)
  ];
  assert.throws(
    () => acquireSseConnection(request("actor-c", "203.0.113.2"), reply(), ipEnv),
    (error) => error.details?.scope === "sse_ip"
  );
  leases.forEach((release) => release());

  const totalEnv = {
    SSE_MAX_CONNECTIONS_PER_ACTOR: "5",
    SSE_MAX_CONNECTIONS_PER_IP: "5",
    SSE_MAX_CONNECTIONS_TOTAL: "2"
  };
  const totalLeases = [
    acquireSseConnection(request("actor-a", "203.0.113.3"), reply(), totalEnv),
    acquireSseConnection(request("actor-b", "203.0.113.4"), reply(), totalEnv)
  ];
  assert.throws(
    () => acquireSseConnection(request("actor-c", "203.0.113.5"), reply(), totalEnv),
    (error) => error.details?.scope === "sse_total"
  );
  totalLeases.forEach((release) => release());
});
