#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function walk(directory) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(relative) : [relative.replace(/\\/g, "/")];
  });
}

const sourceFiles = ["backend/src", "src", "host/src", "play/src", "shared"]
  .flatMap(walk)
  .filter((file) => /\.(?:js|mjs|ts|tsx)$/.test(file));

const nativeFetchAllowlist = new Set([
  "backend/src/deepseek-client.js",
  "backend/src/llm-probe.js",
  "backend/src/upstream-fetch.js",
  "shared/api-fetch.js",
  "shared/sse-client.js",
  "shared/web-vitals.js",
  "src/api/assets.js",
  "src/components/creator-guide.js"
]);

let nativeFetchCalls = 0;
for (const file of sourceFiles) {
  const lines = read(file).split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || !/(^|[^\w.])fetch\s*\(/.test(lines[index])) continue;
    nativeFetchCalls += 1;
    if (!nativeFetchAllowlist.has(file)) {
      failures.push(`${file}:${index + 1} uses native fetch outside the reviewed transport boundary`);
      continue;
    }
    const window = lines.slice(index, index + 18).join("\n");
    if (!/\bsignal\s*[:,}]/.test(window)) {
      failures.push(`${file}:${index + 1} native fetch has no timeout/cancellation signal`);
    }
  }
}

const backendTimerAllowlist = new Set([
  "backend/src/non-overlapping-interval.js",
  "backend/src/routes/platform-social-routes.js",
  "backend/src/routes/room-events-routes.js"
]);
for (const file of sourceFiles.filter((entry) => entry.startsWith("backend/src/"))) {
  if (!/\bsetInterval\s*\(/.test(read(file))) continue;
  if (!backendTimerAllowlist.has(file)) failures.push(`${file} creates an unreviewed backend interval`);
}

const providerFiles = [
  "backend/src/email/providers/mailgun.js",
  "backend/src/email/providers/resend.js",
  "backend/src/email/providers/sendgrid.js",
  "backend/src/oauth-service.js",
  "backend/src/ops-alert-bridge.js",
  "backend/src/stripe-billing.js",
  "backend/src/upload-scan.js"
];
for (const file of providerFiles) {
  if (!read(file).includes("fetchUpstream")) failures.push(`${file} bypasses the upstream timeout boundary`);
}

const invariants = [
  ["backend/src/db.js", "connectionTimeoutMillis", "database pool acquisition must be bounded"],
  ["backend/src/db.js", "maxLifetimeSeconds", "database connections must be recycled"],
  ["backend/src/rate-limit.js", "MAX_BUCKETS", "rate-limit memory must be bounded"],
  ["backend/src/rate-limit.js", "request.actorId", "authenticated limits must not share a proxy IP bucket"],
  ["backend/src/auth.js", "SESSION_LAST_SEEN_TOUCH_SECONDS", "session validation must avoid per-request write amplification"],
  ["backend/src/auth.js", "DUMMY_PASSWORD_HASH", "unknown login accounts must still execute password derivation"],
  ["backend/src/api-errors.js", "statusCode >= 500", "unexpected server errors must be redacted"],
  ["backend/src/server.js", "shutdownPromise", "shutdown must be idempotent"],
  ["backend/src/server.js", "Promise.allSettled", "shutdown must drain independent services"],
  ["backend/src/postgres-event-listener.js", "scheduleReconnect();", "LISTEN cold-start failures must self-heal"],
  ["backend/src/sse-response.js", "writableLength", "SSE slow consumers must have a buffer ceiling"],
  ["backend/src/sse-response.js", "resolveSseMaxConnectionAgeMs", "SSE streams must periodically reauthenticate"],
  ["backend/src/sse-replay-subscription.js", "maxBufferedEvents", "SSE replay races must have an event buffer ceiling"],
  ["backend/src/routes/room-events-routes.js", "projectRoomEventEnvelope", "room SSE must enforce server-side player audiences"],
  ["backend/src/logger-config.js", ".split(\"?\")[0]", "request logs must strip sensitive query strings"],
  ["backend/src/deepseek-client.js", "assertSafeOutboundHttpsUrl", "user LLM endpoints must be checked for SSRF"],
  ["backend/src/deepseek-client.js", "redirect: \"manual\"", "LLM redirects must not bypass the outbound URL policy"],
  ["backend/test/hooks.mjs", "assertSafeDatabaseUrlForTestWrites", "test fixture bootstrap must reject production databases"],
  ["backend/scripts/player-home-performance-fixture.mjs", "assertSafeDatabaseUrlForTestWrites", "performance fixtures must reject production databases"],
  ["backend/scripts/verify-migration-upgrade.mjs", "assertSafeDatabaseUrlForDestructiveOps", "migration drills must reject production databases"],
  ["backend/scripts/verify-backup-restore-managed.mjs", "assertSafeDatabaseUrlForDestructiveOps", "managed restore drills must reject production databases"],
  ["backend/.env.production.example", "CSP_MODE=enforce", "production CSP must be enforced"],
  ["backend/.env.production.example", "TRUSTED_TYPES_ENFORCE=true", "production Trusted Types must be enforced"],
  ["backend/.env.production.example", "ALLOW_DEMO_USER_HEADER=false", "production demo identity bypass must be disabled"]
];
for (const [file, marker, message] of invariants) {
  if (!read(file).includes(marker)) failures.push(`${file}: ${message}`);
}

const entrypointBudgets = {
  "play/src/main.js": 450,
  "host/src/main.js": 150
};
for (const [file, maxLines] of Object.entries(entrypointBudgets)) {
  const lines = read(file).split(/\r?\n/).length;
  if (lines > maxLines) failures.push(`${file} has ${lines} lines (budget ${maxLines})`);
}

console.log(`nonfunctional audit: ${sourceFiles.length} source files, ${nativeFetchCalls} reviewed native fetch calls`);
console.log(`provider timeout contracts: ${providerFiles.length}/${providerFiles.length}`);
console.log(`entrypoint budgets: ${Object.keys(entrypointBudgets).length}`);
if (failures.length) {
  console.error("\nNonfunctional audit violations:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log("nonfunctional audit passed");
}
