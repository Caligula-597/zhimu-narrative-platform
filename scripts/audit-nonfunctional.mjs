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
  // Presigned R2 avatar PUTs cannot use the JSON API client. This boundary
  // validates type/size first and supplies its own abort timer.
  "shared/portal-profile-client.js",
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

// Frontend refreshes and elapsed-time displays share one visibility-aware,
// non-overlapping scheduler so hidden tabs never keep permanent intervals alive.
for (const file of sourceFiles.filter((entry) => !entry.startsWith("backend/src/"))) {
  if (!/\bsetInterval\s*\(/.test(read(file))) continue;
  failures.push(`${file} creates a frontend interval; use createAdaptivePoller`);
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
  ["backend/src/deepseek-client.js", "fetchPinnedOutboundJson", "LLM connections must pin validated DNS answers"],
  ["backend/src/pinned-outbound-fetch.js", "redirect: \"manual\"", "LLM redirects must not bypass the outbound URL policy"],
  ["backend/src/network-trust-policy.js", "multiInstanceSafe", "in-process rate limits must disclose multi-instance safety"],
  ["shared/api-client.js", "rejectedAuthorization", "late 401 responses must not clear a newer bearer token"],
  ["shared/auth-state.js", "shouldInvalidateSessionForUnauthorized", "failed login attempts must not revoke an active session"],
  ["shared/sse-lifecycle.js", "staleCredential", "stale SSE handshakes must reconnect without logging out a new session"],
  ["shared/sse-lifecycle.js", "createAdaptivePoller", "SSE fallback and reconciliation must use adaptive polling"],
  ["shared/adaptive-poller.js", "visibilityState", "frontend polling must pause in hidden tabs"],
  ["shared/adaptive-poller.js", "if (inFlight) return inFlight", "frontend polling must not overlap slow requests"],
  ["backend/test/hooks.mjs", "assertSafeDatabaseUrlForTestWrites", "test fixture bootstrap must reject production databases"],
  ["backend/scripts/player-home-performance-fixture.mjs", "assertSafeDatabaseUrlForTestWrites", "performance fixtures must reject production databases"],
  ["backend/scripts/benchmark-player-home.mjs", "productionRepresentativeAuth", "performance evidence must disclose whether authentication is production-representative"],
  ["backend/scripts/benchmark-player-home.mjs", "capacityEvidenceReady", "staging performance evidence must bind thresholds to deployment context"],
  ["backend/scripts/benchmark-sse-capacity.mjs", "this tool refuses production targets", "SSE capacity tooling must reject production targets"],
  ["backend/scripts/benchmark-sse-capacity.mjs", "--confirm-host must exactly match", "SSE capacity tooling must require exact host confirmation"],
  ["backend/scripts/benchmark-sse-fanout.mjs", "room.test_capacity_probe", "SSE fan-out must measure the durable event path"],
  ["backend/src/capacity-probe-policy.js", "CAPACITY_PROBE_ENVIRONMENT", "capacity probes must be fail-closed outside staging"],
  ["backend/scripts/r2-cross-bucket-restore-drill.mjs", "this drill refuses production buckets", "R2 restore drills must reject production buckets"],
  ["backend/scripts/r2-cross-bucket-restore-drill.mjs", "SAFE_PREFIX", "R2 restore drills must isolate probe keys"],
  ["backend/scripts/lib/object-backup.mjs", "content-addressed blob size mismatch", "object backups must be content-addressed and verified"],
  ["backend/scripts/restore-object-storage-backup.mjs", "production targets are refused", "object restores must reject production targets"],
  ["backend/scripts/upload-postgres-backup.mjs", "fullReadBackVerified", "off-site database backups must be read back"],
  ["backend/scripts/verify-migration-upgrade.mjs", "assertSafeDatabaseUrlForDestructiveOps", "migration drills must reject production databases"],
  ["backend/scripts/verify-backup-restore-managed.mjs", "assertSafeDatabaseUrlForDestructiveOps", "managed restore drills must reject production databases"],
  ["scripts/verify-full-repeat.mjs", "requestedRuns", "repeat verification must record every requested isolated run"],
  ["scripts/sync-railway-env.mjs", "EDGE_RATE_LIMIT_VERIFIED", "deployment env must preserve the edge rate-limit trust gate"],
  ["backend/scripts/verify-release-rollback.mjs", "applicationImageRollbackCovered", "release recovery evidence must disclose the separate image rollback gate"],
  ["scripts/verify-platform-recovery-evidence.mjs", "r2-cross-bucket-restore", "platform recovery evidence must require actual R2 restore coverage"],
  ["scripts/verify-platform-recovery-evidence.mjs", "independentObjectBackup", "platform recovery evidence must include independent object backup"],
  ["scripts/verify-capacity-evidence.mjs", "sse-durable-event-fanout", "capacity evidence must include durable SSE fan-out"],
  ["scripts/verify-supabase-pitr.mjs", "pitr_enabled", "commercial database recovery must verify PITR"],
  ["scripts/railway-staging-rollback-drill.mjs", "restoredImageAndVariables", "platform rollback drills must verify exact image and variables"],
  ["site/public/_headers", "require-trusted-types-for 'script'", "marketing pages must enforce Trusted Types"],
  ["host/public/_headers", "require-trusted-types-for 'script'", "host pages must enforce Trusted Types"],
  ["play/public/_headers", "require-trusted-types-for 'script'", "player pages must enforce Trusted Types"],
  ["host/public/_headers", "Strict-Transport-Security", "host pages must enforce HTTPS persistence"],
  ["play/public/_headers", "Strict-Transport-Security", "player pages must enforce HTTPS persistence"],
  ["config/production-artifact-guard.mjs", "unlinkSync", "production builds must purge stale source maps"],
  ["backend/.env.production.example", "CSP_MODE=enforce", "production CSP must be enforced"],
  ["backend/.env.production.example", "TRUSTED_TYPES_ENFORCE=true", "production Trusted Types must be enforced"],
  ["backend/.env.production.example", "ALLOW_DEMO_USER_HEADER=false", "production demo identity bypass must be disabled"]
];
for (const [file, marker, message] of invariants) {
  if (!read(file).includes(marker)) failures.push(`${file}: ${message}`);
}

const portalStreamFiles = [
  "src/runtime/room-events.js",
  "host/src/runtime/room-events.js",
  "play/src/room-events.js",
  "play/src/platform-events.js"
];
for (const file of portalStreamFiles) {
  const source = read(file);
  if (!source.includes("createPortalEventLifecycle")) {
    failures.push(`${file}: portal streams must use the shared event lifecycle adapter`);
  }
  if (!source.includes("PORTAL_POLL_INTERVAL_MS")) {
    failures.push(`${file}: portal polling cadence must use the shared interval contract`);
  }
  if (/\bcreateSseLifecycle\s*\(/.test(source)) {
    failures.push(`${file}: portal controller reimplements the low-level SSE lifecycle`);
  }
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
