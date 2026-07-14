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
  /chi_sim\.traineddata$/i,
  /RESUME_PROJECT/i
];

const BACKEND_PREFIX_TESTS = [
  ["backend/src/room-event-bus", ["test/room-events.test.js", "test/room-event-bus-postgres.test.js"]],
  ["backend/src/room-event-journal", ["test/room-event-journal.test.js"]],
  ["backend/src/platform-event-bus", ["test/platform-event-bus-postgres.test.js", "test/platform-event-journal.test.js"]],
  ["backend/src/platform-event-journal", ["test/platform-event-journal.test.js"]],
  ["backend/src/postgres-event-listener", ["test/postgres-event-listener.test.js", "test/room-event-bus-postgres.test.js", "test/platform-event-bus-postgres.test.js"]],
  ["backend/src/postgres-notify", ["test/postgres-notify.test.js"]],
  ["backend/src/sse-replay-subscription", ["test/sse-replay-subscription.test.js"]],
  ["backend/src/db.js", ["test/creator-bible.test.js", "test/transaction-events.test.js"]],
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
  ["backend/src/routes/recap-routes", ["test/recap.test.js"]],
  ["backend/src/routes/player-routes", ["test/player-host-confirm.test.js"]],
  ["backend/src/routes/player-access-routes", ["test/player-host-confirm.test.js"]],
  ["backend/src/routes/player-progress-routes", ["test/player-host-confirm.test.js"]],
  ["backend/src/routes/player-exploration-routes", ["test/player-host-confirm.test.js"]],
  ["backend/src/routes/host-routes", ["test/host-console.test.js", "test/host-player-assessment.test.js"]],
  ["backend/src/player-progress-assessment.js", ["test/host-player-assessment.test.js"]],
  ["backend/src/rule-condition-evaluator", ["test/rule-runtime.test.js", "test/rule-engine.test.js"]],
  ["backend/src/rule-engine", ["test/rule-runtime.test.js", "test/rule-engine.test.js"]],
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
}

for (const f of files.filter((p) => /\.(js|mjs|cjs)$/.test(p))) {
  run(`syntax ${f}`, `node --check "${f}"`);
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

for (const t of backendTests) {
  run(
    `backend ${t}`,
    `node --test-concurrency=1 --test-force-exit --import ./test/hooks.mjs --test ${t}`,
    backendRoot
  );
}

if (files.some((f) => f.startsWith("backend/"))) {
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

if (files.some((f) => /^src\/runtime\/(workspace-store|runtime-store|data)\.js/.test(f))) {
  run("test:runtime-stores", "npm run test:runtime-stores");
}

if (files.some((f) => f.startsWith("play/"))) {
  run("test:play", "npm run test:play");
}

if (files.some((f) => f.startsWith("host/"))) {
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
