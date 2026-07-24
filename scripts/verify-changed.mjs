/**
 * Run checks scoped to git-changed files only (not the full test suite).
 * Usage: node scripts/verify-changed.mjs
 * Exit 0 = safe to commit; non-zero = block commit.
 */
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = path.join(root, "backend");

const BLOCKED_PATH = [
  /^\.env$/i,
  /\.env\./i,
  /credentials\.json$/i,
  /\.pem$/i,
  /chi_sim\.traineddata$/i
];
const PROTECTED_DOCUMENT_PATH = [/RESUME_PROJECT/i];

const BACKEND_PREFIX_TESTS = [
  ["backend/src/room-event-bus", ["test/room-events.test.js", "test/room-event-bus-postgres.test.js"]],
  ["backend/src/room-event-journal", ["test/room-event-journal.test.js"]],
  ["backend/src/platform-event-bus", ["test/platform-event-bus-postgres.test.js", "test/platform-event-journal.test.js"]],
  ["backend/src/platform-event-journal", ["test/platform-event-journal.test.js"]],
  ["backend/src/postgres-event-listener", ["test/postgres-event-listener.test.js", "test/room-event-bus-postgres.test.js", "test/platform-event-bus-postgres.test.js"]],
  ["backend/src/postgres-notify", ["test/postgres-notify.test.js"]],
  ["backend/src/sse-replay-subscription", ["test/sse-replay-subscription.test.js"]],
  ["backend/src/db.js", ["test/creator-bible.test.js", "test/transaction-events.test.js"]],
  ["backend/src/database-status", ["test/database-status.test.js", "test/creator-room-integrity.test.js", "test/ops-health.test.js"]],
  ["backend/src/auth-recovery-service", ["test/auth-recovery-integrity.test.js", "test/auth-password-reset.test.js", "test/auth-email-verification.test.js"]],
  ["backend/src/auth-identity-errors", ["test/auth-identity-integrity.test.js"]],
  ["backend/src/auth-registration-service", ["test/auth-identity-integrity.test.js", "test/identity-foundation.test.js", "test/register-ip-limit.test.js", "test/auth-email-verification.test.js", "test/beta-apply.test.js"]],
  ["backend/src/auth-session-service", ["test/auth-identity-integrity.test.js", "test/identity-foundation.test.js", "test/auth-password-reset.test.js", "test/session-cookie.test.js"]],
  ["backend/src/oauth-service", ["test/oauth.test.js", "test/oauth-return-origin.test.js"]],
  ["backend/src/oauth-identity-service", ["test/oauth.test.js"]],
  ["backend/src/auth-token", ["test/auth-recovery-integrity.test.js", "test/auth-password.test.js", "test/session-cookie.test.js"]],
  ["backend/src/auth.js", ["test/auth-recovery-integrity.test.js", "test/auth-password-reset.test.js", "test/auth-email-verification.test.js", "test/auth-session-touch.test.js", "test/auth-password.test.js", "test/session-cookie.test.js"]],
  ["backend/src/play-social-guard", ["test/auth-identity-integrity.test.js", "test/register-ip-limit.test.js"]],
  ["backend/src/app.js", ["test/app-auth.test.js", "test/auth-recovery-integrity.test.js", "test/rate-limit.test.js", "test/security-headers.test.js"]],
  ["backend/src/repositories/auth-recovery-repository", ["test/auth-recovery-integrity.test.js", "test/auth-password-reset.test.js", "test/auth-email-verification.test.js"]],
  ["backend/src/repositories/auth-identity-repository", ["test/auth-identity-integrity.test.js", "test/identity-foundation.test.js", "test/auth-email-verification.test.js", "test/beta-apply.test.js"]],
  ["backend/src/repositories/auth-registration-repository", ["test/auth-identity-integrity.test.js", "test/register-ip-limit.test.js"]],
  ["backend/src/repositories/auth-session-repository", ["test/auth-identity-integrity.test.js", "test/identity-foundation.test.js", "test/session-cookie.test.js"]],
  ["backend/src/repositories/oauth-repository", ["test/oauth.test.js"]],
  ["backend/src/routes/auth-recovery-routes", ["test/auth-recovery-integrity.test.js", "test/auth-password-reset.test.js", "test/auth-email-verification.test.js"]],
  ["backend/src/routes/auth-registration-routes", ["test/auth-email-verification.test.js", "test/app-auth.test.js"]],
  ["backend/src/routes/auth-session-routes", ["test/auth-identity-integrity.test.js", "test/identity-foundation.test.js", "test/session-cookie.test.js"]],
  ["backend/src/routes/auth-oauth-routes", ["test/oauth.test.js", "test/oauth-return-origin.test.js"]],
  ["backend/src/routes/auth-route-shared", ["test/auth-password-reset.test.js", "test/auth-email-verification.test.js", "test/app-auth.test.js"]],
  ["backend/src/script-bundle", ["test/script-bundle.test.js", "test/script-bundle-import.test.js"]],
  ["backend/src/pdf-document", ["test/pdf-document.test.js"]],
  ["backend/src/document-parser", ["test/pdf-document.test.js"]],
  ["backend/src/document-page-import", ["test/pdf-document.test.js"]],
  ["backend/src/document-text-import", ["test/pdf-document.test.js"]],
  ["backend/src/catalog-review-ops", ["test/ops-catalog.test.js"]],
  ["backend/src/routes/ops-catalog-routes", ["test/ops-catalog.test.js"]],
  ["backend/src/membership-labels", ["test/membership-labels.test.js"]],
  ["backend/src/official-example", ["test/official-example.test.js"]],
  ["backend/src/catalog-join-service", ["test/catalog-join-service.test.js", "test/world-catalog.test.js"]],
  ["backend/src/creator-room-service", ["test/creator-room-service.test.js", "test/creator-room-integrity.test.js", "test/world-rooms-list.test.js", "test/public-room-listing.test.js"]],
  ["backend/src/creator-role-service", ["test/creator-structure-integrity.test.js", "test/creator-role-profile.test.js", "test/world-revision.test.js"]],
  ["backend/src/creator-chapter-service", ["test/creator-structure-integrity.test.js", "test/studio-edit.test.js", "test/world-revision.test.js"]],
  ["backend/src/creator-structure-errors", ["test/creator-structure-errors.test.js"]],
  ["backend/src/creator-structure-service", ["test/creator-structure-errors.test.js", "test/creator-structure-integrity.test.js", "test/world-revision.test.js"]],
  ["backend/src/repositories/creator-role-repository", ["test/creator-structure-integrity.test.js", "test/creator-role-profile.test.js"]],
  ["backend/src/repositories/creator-chapter-repository", ["test/creator-structure-integrity.test.js", "test/studio-edit.test.js"]],
  ["backend/src/repositories/creator-structure-access-repository", ["test/creator-structure-integrity.test.js", "test/world-revision.test.js"]],
  ["backend/src/repositories/creator-room-repository", ["test/creator-room-integrity.test.js", "test/world-rooms-list.test.js", "test/public-room-listing.test.js"]],
  ["backend/src/routes/creator-room-routes", ["test/creator-room-integrity.test.js", "test/world-rooms-list.test.js", "test/public-room-listing.test.js"]],
  ["backend/src/routes/creator-role-routes", ["test/creator-structure-integrity.test.js", "test/creator-role-profile.test.js"]],
  ["backend/src/routes/creator-chapter-routes", ["test/creator-structure-integrity.test.js", "test/studio-edit.test.js"]],
  ["backend/src/routes/official-example-routes", ["test/official-example.test.js"]],
  ["backend/test/permissions-matrix.test.js", ["test/permissions-matrix.test.js", "test/runtime-permissions.test.js"]],
  ["backend/src/routes/route-guards.js", ["test/permissions-matrix.test.js", "test/runtime-permissions.test.js"]],
  ["backend/src/world-publish-readiness", ["test/world-publish-readiness.test.js"]],
  ["backend/src/world-readiness-service", ["test/world-readiness-routes.test.js", "test/catalog-readiness-gate.test.js"]],
  ["backend/src/routes/world-readiness-routes", ["test/world-readiness-routes.test.js"]],
  ["backend/src/import-guide", ["test/world-readiness-routes.test.js"]],
  ["backend/src/wizard-automation-templates", ["test/world-wizard.test.js"]],
  ["backend/src/world-wizard-bootstrap", ["test/world-wizard.test.js"]],
  ["backend/src/world-templates", ["test/world-wizard.test.js"]],
  ["backend/src/routes/world-wizard-routes", ["test/world-wizard.test.js"]],
  ["backend/src/catalog-review", ["test/world-catalog.test.js", "test/catalog-readiness-gate.test.js"]],
  ["backend/src/beta-apply", ["test/beta-apply.test.js", "test/platform-site.test.js"]],
  ["backend/src/email/support-templates", ["test/support-templates.test.js", "test/beta-apply.test.js"]],
  ["backend/scripts/render-support-email", ["test/support-templates.test.js"]],
  ["backend/src/world-cover", ["test/world-cover.test.js", "test/platform-site.test.js"]],
  ["backend/src/platform-site", ["test/platform-site.test.js"]],
  ["backend/src/pricing-pages", ["test/pricing-pages.test.js", "test/platform-site.test.js"]],
  ["backend/src/account-entitlements", ["test/account-entitlements.test.js", "test/plan-upgrade-request.test.js"]],
  ["backend/src/recap-narrative", ["test/recap-narrative.test.js", "test/recap.test.js"]],
  ["backend/src/routes/recap-helpers", ["test/recap.test.js", "test/recap-narrative.test.js"]],
  ["backend/src/recap-service", ["test/recap.test.js", "test/recap-integrity.test.js"]],
  ["backend/src/repositories/recap-repository", ["test/recap.test.js", "test/recap-integrity.test.js"]],
  ["backend/src/recap-snapshot-repository", ["test/recap.test.js", "test/recap-integrity.test.js", "test/recap-query-scheduler.test.js"]],
  ["backend/src/recap-abuse-protection", ["test/recap-abuse-protection.test.js"]],
  ["backend/src/routes/recap-routes", ["test/recap.test.js", "test/recap-integrity.test.js"]],
  ["backend/src/host-communication-service", ["test/host-communication-integrity.test.js", "test/host-communication-service.test.js"]],
  ["backend/src/repositories/host-communication-repository", ["test/host-communication-integrity.test.js"]],
  ["backend/src/host-communication-abuse-protection", ["test/host-communication-abuse-protection.test.js"]],
  ["backend/src/routes/host-communication-routes", ["test/host-communication-integrity.test.js", "test/host-console.test.js"]],
  ["backend/src/host-player-management-service", ["test/host-kick-player.test.js", "test/host-player-management-service.test.js"]],
  ["backend/src/repositories/host-player-management-repository", ["test/host-kick-player.test.js"]],
  ["backend/src/host-player-management-abuse-protection", ["test/host-player-management-abuse-protection.test.js"]],
  ["backend/src/routes/host-player-management-routes", ["test/host-kick-player.test.js"]],
  ["backend/src/host-game-control-service", ["test/host-game-control-integrity.test.js", "test/mini-game.test.js", "test/rule-runtime.test.js", "test/world-settings.test.js"]],
  ["backend/src/repositories/host-game-control-repository", ["test/host-game-control-integrity.test.js", "test/world-settings.test.js"]],
  ["backend/src/routes/host-game-control-routes", ["test/host-game-control-integrity.test.js", "test/mini-game.test.js", "test/rule-runtime.test.js", "test/world-settings.test.js"]],
  ["backend/src/room-mini-games", ["test/host-game-control-integrity.test.js", "test/mini-game.test.js"]],
  ["backend/src/rule-engine", ["test/rule-runtime.test.js", "test/rules-integrity.test.js"]],
  ["backend/src/routes/player-routes", ["test/player-host-confirm.test.js"]],
  ["backend/src/routes/player-access-routes", ["test/player-host-confirm.test.js"]],
  ["backend/src/routes/player-progress-routes", ["test/player-host-confirm.test.js"]],
  ["backend/src/routes/player-exploration-routes", ["test/player-host-confirm.test.js"]],
  ["backend/src/routes/host-routes", ["test/host-console.test.js", "test/host-player-assessment.test.js"]],
  ["backend/src/player-progress-assessment.js", ["test/host-player-assessment.test.js"]],
  ["backend/src/rule-condition-evaluator", ["test/rule-runtime.test.js", "test/rule-engine.test.js"]],
  ["backend/src/rule-engine", ["test/rule-runtime.test.js", "test/rule-engine.test.js"]],
  ["backend/src/content-platform-run-report-service", ["test/content-platform-report-service.test.js", "test/content-platform.test.js"]],
  ["backend/src/repositories/content-platform-run-report-repository", ["test/content-platform-report-service.test.js", "test/content-platform.test.js"]],
  ["backend/src/routes/content-platform-run-report-routes", ["test/content-platform-report-service.test.js", "test/content-platform.test.js"]],
  ["backend/src/content-platform-insight-service", ["test/content-platform-report-service.test.js", "test/content-platform.test.js", "test/player-reading-start.test.js"]],
  ["backend/src/repositories/content-platform-insight-repository", ["test/content-platform-report-service.test.js", "test/content-platform.test.js"]],
  ["backend/src/creator-analytics-repository", ["test/creator-analytics-service.test.js", "test/player-reading-start.test.js"]],
  ["backend/src/routes/content-platform-insight-routes", ["test/content-platform.test.js", "test/player-reading-start.test.js"]],
  ["backend/src/batch-b-service", ["test/route-domain-services.test.js", "test/batch-b.test.js"]],
  ["backend/src/segment-remedies", ["test/route-domain-services.test.js", "test/batch-b.test.js"]],
  ["backend/src/routes/batch-b-routes", ["test/route-domain-services.test.js", "test/batch-b.test.js"]],
  ["backend/src/physical-token-service", ["test/route-domain-services.test.js", "test/physical-token.test.js"]],
  ["backend/src/routes/physical-token-routes", ["test/route-domain-services.test.js", "test/physical-token.test.js"]],
  ["backend/src/host-event-service", ["test/route-domain-services.test.js", "test/host-console.test.js", "test/host-event-robustness.test.js"]],
  ["backend/src/repositories/host-event-repository", ["test/route-domain-services.test.js", "test/host-console.test.js"]],
  ["backend/src/routes/host-event-routes", ["test/route-domain-services.test.js", "test/host-console.test.js", "test/host-event-robustness.test.js"]],
  ["backend/src/billing-service", ["test/route-domain-services.test.js", "test/stripe-billing.test.js"]],
  ["backend/src/repositories/billing-repository", ["test/route-domain-services.test.js", "test/stripe-billing.test.js"]],
  ["backend/src/routes/billing-routes", ["test/route-domain-services.test.js", "test/stripe-billing.test.js"]],
  ["backend/src/host-monitor-service", ["test/route-domain-services.test.js", "test/host-console.test.js", "test/host-player-assessment.test.js"]],
  ["backend/src/repositories/host-monitor-repository", ["test/route-domain-services.test.js", "test/host-console.test.js"]],
  ["backend/src/routes/host-monitor-routes", ["test/route-domain-services.test.js", "test/host-console.test.js", "test/host-player-assessment.test.js"]],
  ["backend/src/studio-story-edge-service", ["test/studio-edit.test.js", "test/creator-schema-validation.test.js"]],
  ["backend/src/repositories/studio-story-edge-repository", ["test/studio-edit.test.js"]],
  ["backend/src/routes/studio-story-edge-routes", ["test/studio-edit.test.js", "test/creator-schema-validation.test.js"]],
  ["backend/src/optional-services-status", ["test/ops-health.test.js"]],
  ["backend/src/routes/system-routes", ["test/ops-health.test.js", "test/security-headers.test.js", "test/web-vitals-metrics.test.js"]],
  ["backend/src/metrics.js", ["test/web-vitals-metrics.test.js"]],
  ["backend/scripts/pg-stat-report.mjs", ["test/pg-stat-statements.test.js"]],
  ["backend/src/security-headers", ["test/security-headers.test.js", "test/app-auth.test.js"]],
  ["backend/src/session-cookie", ["test/session-cookie.test.js", "test/app-auth.test.js"]],
  ["backend/src/world-revision", ["test/world-revision.test.js", "test/world-settings.test.js", "test/studio-edit.test.js"]],
  ["backend/src/data-retention", ["test/data-retention.test.js"]],
  ["backend/src/request-actor", ["test/app-auth.test.js", "test/session-cookie.test.js"]],
  ["backend/src/account-delete", ["test/account-delete.test.js", "test/account-delete-job.test.js"]],
  ["backend/src/account-delete-job", ["test/account-delete-job.test.js", "test/account-delete.test.js"]],
  ["backend/src/account-export", ["test/account-export.test.js"]],
  ["backend/src/routes/account-routes", ["test/account-export.test.js", "test/account-delete.test.js", "test/account-entitlements.test.js"]],
  ["backend/src/routes/creator-routes", ["test/studio-edit.test.js", "test/world-revision.test.js"]],
  ["backend/src/routes/studio-routes", ["test/studio-edit.test.js", "test/world-revision.test.js"]],
  ["backend/src/studio-scene-clue-service", ["test/studio-scene-clue-integrity.test.js", "test/studio-scene-clue-service.test.js", "test/studio-edit.test.js", "test/world-revision.test.js"]],
  ["backend/src/repositories/studio-scene-clue-repository", ["test/studio-scene-clue-integrity.test.js", "test/studio-edit.test.js"]],
  ["backend/src/routes/studio-scene-clue-routes", ["test/studio-scene-clue-integrity.test.js", "test/studio-edit.test.js", "test/world-revision.test.js"]],
  ["backend/src/routes/schemas/studio-scene-clue", ["test/studio-scene-clue-integrity.test.js", "test/creator-schema-validation.test.js", "test/studio-edit.test.js"]],
  ["backend/src/content-platform-truth-service", ["test/content-platform-truth-integrity.test.js", "test/content-platform-truth-service.test.js", "test/creator-bible.test.js", "test/world-revision.test.js"]],
  ["backend/src/repositories/content-platform-truth-repository", ["test/content-platform-truth-integrity.test.js", "test/creator-bible.test.js"]],
  ["backend/src/routes/content-platform-truth-routes", ["test/content-platform-truth-integrity.test.js", "test/creator-bible.test.js", "test/world-revision.test.js"]],
  ["backend/src/routes/schemas/content-platform-truth", ["test/content-platform-truth-integrity.test.js", "test/creator-schema-validation.test.js"]],
  ["backend/src/routes/studio-graph-routes", ["test/studio-edit.test.js", "test/studio-layout.test.js", "test/world-revision.test.js"]],
  ["backend/src/routes/content-package-routes", ["test/content-package.test.js", "test/world-revision.test.js"]],
  ["backend/src/routes/rules-routes", ["test/beta-gates.test.js", "test/world-revision.test.js"]],
  ["backend/src/platform-catalog-preview", ["test/platform-site.test.js"]],
  ["backend/src/cors-origins", ["test/cors-origins.test.js", "test/platform-site.test.js"]],
  ["backend/src/routes/platform-site-routes", ["test/platform-site.test.js"]],
  ["backend/src/routes/platform-beta-routes", ["test/beta-apply.test.js", "test/platform-site.test.js"]],
  ["backend/scripts/seed.js", ["test/official-example.test.js"]],
];

function gitLines(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function changedFiles() {
  const all = [
    ...gitLines("git diff --name-only"),
    ...gitLines("git diff --name-only --cached"),
    ...gitLines("git ls-files --others --exclude-standard")
  ];
  return [...new Set(all)].filter((f) => fs.existsSync(path.join(root, f)));
}

function run(name, cmd, cwd = root) {
  console.log(`\n▶ ${name}\n   ${cmd}`);
  const result = spawnSync(cmd, { cwd, shell: true, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    console.error(`\n✗ verify-changed failed at: ${name}`);
    process.exit(result.status || 1);
  }
}

function addBackendTest(set, rel) {
  if (fs.existsSync(path.join(backendRoot, rel))) set.add(rel);
}

const files = changedFiles();
if (!files.length) {
  console.log("verify-changed: no changed files (nothing to verify)");
  process.exit(0);
}

console.log("verify-changed: scope");
for (const f of files) console.log(`  · ${f}`);

for (const f of files) {
  if (/\.example$/i.test(f)) continue;
  if (BLOCKED_PATH.some((re) => re.test(f))) {
    console.error(`\n✗ blocked sensitive path: ${f}`);
    process.exit(1);
  }
  if (
    PROTECTED_DOCUMENT_PATH.some((re) => re.test(f)) &&
    process.env.ZHIMU_ALLOW_PROTECTED_DOC_CHANGES !== "1"
  ) {
    console.error(
      `\n✗ protected document changed: ${f}\n` +
      "Set ZHIMU_ALLOW_PROTECTED_DOC_CHANGES=1 only after confirming the user requested this document update."
    );
    process.exit(1);
  }
}

for (const f of files.filter((p) => /\.(js|mjs|cjs)$/.test(p))) {
  run(`syntax ${f}`, `node --check "${f}"`);
}

if (files.some((f) =>
  f.endsWith(".md") ||
  f === "package.json" ||
  f === "docs/GENERATED_PROJECT_STATUS.json" ||
  f === "scripts/check-documentation.mjs" ||
  f === "scripts/generate-documentation-index.mjs" ||
  f === "scripts/generate-project-status.mjs"
)) {
  run("documentation consistency", "npm run check:docs");
}

const backendTests = new Set();
for (const f of files) {
  if (f.startsWith("backend/test/") && f.endsWith(".test.js")) {
    addBackendTest(backendTests, f.slice("backend/".length));
  }
  if (f.startsWith("backend/src/")) {
    const base = path.basename(f, path.extname(f));
    addBackendTest(backendTests, `test/${base}.test.js`);
    for (const [prefix, tests] of BACKEND_PREFIX_TESTS) {
      if (f.startsWith(prefix)) tests.forEach((t) => addBackendTest(backendTests, t));
    }
  }
}

if (files.some((f) => f.startsWith("backend/src/routes/schemas") || f === "backend/src/routes.js")) {
  run("backend check:schemas", "npm run check:schemas", backendRoot);
}

if (files.some((f) =>
  f.startsWith("backend/src/routes/schemas") ||
  f === "backend/scripts/generate-contract-types.mjs"
)) {
  run("backend contracts:generate", "npm run contracts:generate", backendRoot);
  run(
    "backend contracts drift",
    "git diff --exit-code -- backend/generated/api-contracts.d.ts shared/generated/api-contracts.d.ts",
    root
  );
}

if (files.some((f) =>
  f.startsWith("shared/contracts/") ||
  f === "backend/src/room-event-schemas.js" ||
  f === "scripts/check-contracts-drift.mjs"
)) {
  run("check contracts drift", "npm run check:contracts");
}

// Let hooks.mjs finish resource teardown. Node's --test-force-exit can abort
// Windows libuv while async handles are already closing, and it hides leaks.
for (const t of backendTests) {
  run(
    `backend ${t}`,
    `node --test-concurrency=1 --import ./test/hooks.mjs --test ${t}`,
    backendRoot
  );
}

if (files.some((f) => f.startsWith("backend/") && !f.endsWith(".md"))) {
  run("backend security audit (high+)", "npm audit --audit-level=high --omit=dev", backendRoot);
}

if (files.some((f) => f.startsWith("backend/migrations/") || f.startsWith("backend/scripts/migrat"))) {
  run(
    "migration integrity unit tests",
    "node --test test/migration-integrity.test.mjs",
    backendRoot
  );
}

const frontendChanged = files.some((f) =>
  /^(src\/|app\.js|index\.html|frontend\/|styles\.css|rule-visual\.js|config\.js)/.test(f)
);
if (frontendChanged) {
  const loadOrderTouched = files.some((f) =>
    /^(app\.js|index\.html|frontend\/main\.js|config\.js)/.test(f) ||
    f.startsWith("src/views/") ||
    f.startsWith("src/components/")
  );
  if (loadOrderTouched) {
    run("frontend check:modules", "npm run check:modules");
  }
}

if (files.some((f) => /src\/views\/pipeline-|pipeline-wizard-session/.test(f))) {
  run("test:pipeline-session", "npm run test:pipeline-session");
}

if (files.some((f) => /^scripts\/(format-helpers|modal-helpers)/.test(f))) {
  run("test:format-helpers", "npm run test:format-helpers");
  run("test:modal-helpers", "npm run test:modal-helpers");
}

if (files.some((f) => /^shared\//.test(f) || /^scripts\/shared-/.test(f))) {
  run("test:shared", "npm run test:shared");
}

if (files.some((f) => [
  "src/api/room.js",
  "src/runtime/auth-world.js",
  "src/runtime/wizard.js",
  "host/src/api.js",
  "host/src/runtime/host-lifecycle-controller.js",
  "scripts/creator-room-client-contract.test.mjs"
].includes(f))) {
  run("test:creator-room-client", "npm run test:creator-room-client");
}

if (files.some((f) => /^src\/runtime\/(workspace-store|runtime-store|data)\.js/.test(f))) {
  run("test:runtime-stores", "npm run test:runtime-stores");
}

if (files.some((f) => f.startsWith("play/") && !f.endsWith(".md"))) {
  run("test:play", "npm run test:play");
}

if (files.some((f) => f.startsWith("host/") && !f.endsWith(".md"))) {
  run("test:host", "npm run test:host");
}

if (files.some((f) => f.startsWith("site/") && /\.(js|mjs|html|css)$/.test(f))) {
  run("site build", "npm run build --prefix site");
  run("test:site-screenshots", "npm run test:site-screenshots");
}

if (files.some((f) => f.startsWith("backend/src/routes/"))) {
  run("check layer boundaries", "node --test scripts/check-layer-boundaries.mjs");
}

if (files.some((f) => /^scripts\/guardian-/.test(f))) {
  run("guardian product probes test", "node --test scripts/guardian-product-probes.test.mjs");
}

if (files.some((f) => f.startsWith("backend/migrations/063"))) {
  run("backend db:migrate", "npm run db:migrate", backendRoot);
}

console.log("\n✓ verify-changed passed");
