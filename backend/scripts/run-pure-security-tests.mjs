#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const testFiles = [
  "test/account-delete-authorization.test.js",
  "test/auth-session-response.test.js",
  "test/cookie-request-origin.test.js",
  "test/database-test-runner-guard.test.js",
  "test/health-response-policy.test.js",
  "test/health-status-cache.test.js",
  "test/llm-credential-security.test.js",
  "test/ops-rate-limit-trust.test.js",
  "test/oauth-request-policy.test.js",
  "test/preauth-network-limit.test.js",
  "test/public-telemetry-policy.test.js",
  "test/public-service-status.test.js",
  "test/request-actor.test.js",
  "test/sensitive-cache-policy.test.js",
  "test/sse-connection-guard.test.js",
  "test/upstream-fetch.test.js",
  "test/upload-object-promotion.test.js",
  "test/world-invites-security.test.js"
];

// These tests exercise pure request/security policy. Force an intentionally
// unreachable loopback URL so an inherited managed DATABASE_URL can never be
// used, while modules that construct a lazy PG pool can still be imported.
const result = spawnSync(process.execPath, [
  "--test-concurrency=1",
  "--test",
  ...testFiles
], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:65432/zhimu_security_pure"
  }
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
