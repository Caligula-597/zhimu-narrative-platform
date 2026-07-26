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

test("production trust rejects unverified database TLS and missing identity foundation", () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    databaseSsl: process.env.DATABASE_SSL,
    databaseVerify: process.env.DATABASE_SSL_VERIFY
  };
  process.env.NODE_ENV = "production";
  process.env.DATABASE_SSL = "true";
  process.env.DATABASE_SSL_VERIFY = "false";
  try {
    const result = productionTrustGates({
      features: {
        uploadScan: { mode: "webhook", webhookConfigured: true },
        telemetry: { enabled: true, initialized: true },
        alerts: { configured: true },
        rateLimitTopology: resolveRateLimitTopology({
          TRUST_PROXY_HOPS: "1",
          APP_INSTANCE_COUNT: "1"
        })
      },
      rateLimits: { authPerMin: 20 },
      readiness: { missingTables: [] },
      identityFoundation: {
        ready: false,
        usersMissingPlan: 1,
        usersMissingQuota: 0,
        approvedRegisteredUsersWithoutBeta: 0
      }
    });
    assert.equal(result.gates.find((gate) => gate.key === "database_tls")?.ok, false);
    assert.equal(result.gates.find((gate) => gate.key === "secure_sessions")?.ok, true);
    assert.equal(result.gates.find((gate) => gate.key === "identity_foundation")?.ok, false);
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.databaseSsl === undefined) delete process.env.DATABASE_SSL;
    else process.env.DATABASE_SSL = previous.databaseSsl;
    if (previous.databaseVerify === undefined) delete process.env.DATABASE_SSL_VERIFY;
    else process.env.DATABASE_SSL_VERIFY = previous.databaseVerify;
  }
});

test("production trust requires encrypted BYOK and excludes the platform key from user routing", () => {
  const previous = {
    platformAccess: process.env.PLATFORM_LLM_USER_ACCESS,
    llmSecret: process.env.LLM_CREDENTIALS_SECRET,
    opsToken: process.env.OPS_API_TOKEN
  };
  process.env.PLATFORM_LLM_USER_ACCESS = "false";
  process.env.LLM_CREDENTIALS_SECRET = "test-only-llm-credential-secret";
  try {
    const result = productionTrustGates({
      features: {
        uploadScan: { mode: "webhook", webhookConfigured: true },
        telemetry: { enabled: true, initialized: true },
        alerts: { configured: true },
        rateLimitTopology: resolveRateLimitTopology({
          TRUST_PROXY_HOPS: "1",
          APP_INSTANCE_COUNT: "1"
        })
      },
      rateLimits: { authPerMin: 20 },
      readiness: { missingTables: [] },
      identityFoundation: { ready: true }
    });
    const keys = result.gates.map((gate) => gate.key);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(result.gates.find((gate) => gate.key === "user_ai_byok")?.ok, true);

    process.env.PLATFORM_LLM_USER_ACCESS = "true";
    const exposed = productionTrustGates({
      features: {
        uploadScan: { mode: "webhook", webhookConfigured: true },
        telemetry: { enabled: true, initialized: true },
        alerts: { configured: true },
        rateLimitTopology: resolveRateLimitTopology({
          TRUST_PROXY_HOPS: "1",
          APP_INSTANCE_COUNT: "1"
        })
      },
      rateLimits: { authPerMin: 20 },
      readiness: { missingTables: [] },
      identityFoundation: { ready: true }
    });
    assert.equal(exposed.gates.find((gate) => gate.key === "user_ai_byok")?.ok, false);
  } finally {
    if (previous.platformAccess === undefined) delete process.env.PLATFORM_LLM_USER_ACCESS;
    else process.env.PLATFORM_LLM_USER_ACCESS = previous.platformAccess;
    if (previous.llmSecret === undefined) delete process.env.LLM_CREDENTIALS_SECRET;
    else process.env.LLM_CREDENTIALS_SECRET = previous.llmSecret;
    if (previous.opsToken === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = previous.opsToken;
  }
});
