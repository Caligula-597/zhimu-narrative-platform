import assert from "node:assert/strict";
import test from "node:test";
import { allRateLimitsPositive, productionTrustGates } from "../src/routes/ops-routes.js";
import { resolveRateLimitTopology } from "../src/network-trust-policy.js";

test("ops production trust accepts nested positive rate-limit policies", () => {
  assert.equal(allRateLimitsPositive({
    authPerMin: 20,
    roomAccess: { joinActorPerMin: 12, joinIpPerMin: 80 },
    voice: { messageActorPerMin: 20 },
    checkpoint: { restoreActorPerMin: 3 }
  }), true);
});

test("ops production trust rejects invalid nested rate-limit policies", () => {
  assert.equal(allRateLimitsPositive({ authPerMin: 20, voice: { messageActorPerMin: 0 } }), false);
  assert.equal(allRateLimitsPositive({ authPerMin: Number.NaN }), false);
});

test("rate-limit topology requires a trusted proxy and an explicit deployment boundary", () => {
  assert.equal(resolveRateLimitTopology({}).trusted, false);
  assert.equal(resolveRateLimitTopology({ TRUST_PROXY_HOPS: "1", APP_INSTANCE_COUNT: "1" }).trusted, true);
  assert.equal(resolveRateLimitTopology({ TRUST_PROXY_HOPS: "1", APP_INSTANCE_COUNT: "2" }).trusted, false);
  assert.equal(resolveRateLimitTopology({
    TRUST_PROXY_HOPS: "1",
    APP_INSTANCE_COUNT: "2",
    EDGE_RATE_LIMIT_VERIFIED: "true"
  }).trusted, true);
});

test("production trust keeps rate-limit gate closed when topology is unverified", () => {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    const commonFeatures = {
      uploadScan: { mode: "webhook", webhookConfigured: true },
      telemetry: { enabled: true, initialized: true },
      alerts: { configured: true }
    };
    const untrusted = productionTrustGates({
      features: { ...commonFeatures, rateLimitTopology: resolveRateLimitTopology({}) },
      rateLimits: { authPerMin: 20 }
    });
    assert.equal(untrusted.gates.find((gate) => gate.key === "rate_limits")?.ok, false);

    const trusted = productionTrustGates({
      features: {
        ...commonFeatures,
        rateLimitTopology: resolveRateLimitTopology({ TRUST_PROXY_HOPS: "1", APP_INSTANCE_COUNT: "1" })
      },
      rateLimits: { authPerMin: 20 }
    });
    assert.equal(trusted.gates.find((gate) => gate.key === "rate_limits")?.ok, true);
  } finally {
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  }
});
