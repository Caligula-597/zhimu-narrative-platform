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
  ["backend/src/platform-site", ["test/platform-site.test.js"]],
  ["backend/src/platform-catalog-preview", ["test/platform-site.test.js"]],
  ["backend/src/cors-origins", ["test/cors-origins.test.js", "test/platform-site.test.js"]],
  ["backend/src/routes/platform-site-routes", ["test/platform-site.test.js"]],
  ["backend/src/routes/platform-beta-routes", ["test/beta-apply.test.js", "test/platform-site.test.js"]],
  ["backend/src/routes/ops-beta-routes", ["test/beta-apply.test.js"]]
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
    ...gitLines("git diff --name-only --cached")
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

if (files.some((f) => /^src\/runtime\/(workspace-store|runtime-store|data)\.js/.test(f))) {
  run("test:runtime-stores", "npm run test:runtime-stores");
}

console.log("\n✓ verify-changed passed");
