/**
 * Generate machine-readable project metrics — single source for doc numbers.
 * Usage: npm run status:generate
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = join(root, "backend");
const migrationsDir = join(backendRoot, "migrations");
const testDir = join(backendRoot, "test");
const schemaScript = join(backendRoot, "scripts", "verify-route-schemas.mjs");
const playTestDir = join(root, "play", "test");

function countBackendTests() {
  const files = readdirSync(testDir).filter((name) => name.endsWith(".test.js"));
  let count = 0;
  for (const file of files) {
    const content = readFileSync(join(testDir, file), "utf8");
    count += (content.match(/^test\(/gm) ?? []).length;
  }
  return { count, files: files.length };
}

function countPlayTests() {
  if (!readdirSync(playTestDir, { withFileTypes: true }).length) return { count: 0, files: 0 };
  const files = readdirSync(playTestDir).filter((name) => name.endsWith(".test.mjs"));
  let count = 0;
  for (const file of files) {
    const content = readFileSync(join(playTestDir, file), "utf8");
    count += (content.match(/^\s*test\(/gm) ?? []).length;
  }
  return { count, files: files.length };
}

function countSchemaRoutes() {
  const content = readFileSync(schemaScript, "utf8");
  return (content.match(/^\s+\[/gm) ?? []).length;
}

function countMigrations() {
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
  const latest = files.sort().at(-1)?.replace(/\.sql$/, "") ?? null;
  return { count: files.length, latest };
}

function countFrontendModules() {
  const result = spawnSync("node", ["scripts/verify-script-load.mjs"], {
    cwd: root,
    encoding: "utf8"
  });
  const okLines = (result.stdout || "").split("\n").filter((line) => line.startsWith("OK"));
  return okLines.length;
}

function main() {
  const backendTests = countBackendTests();
  const playTests = countPlayTests();
  const migrations = countMigrations();
  const schemaRoutes = countSchemaRoutes();
  let frontendModules = 0;
  try {
    frontendModules = countFrontendModules();
  } catch {
    frontendModules = 0;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    git: {
      note: "Run from clean tree; commit hash not embedded to avoid dirty-tree noise."
    },
    backend: {
      unitTests: backendTests.count,
      testFiles: backendTests.files,
      schemaRouteMarkers: schemaRoutes,
      migrations: migrations.count,
      latestMigration: migrations.latest
    },
    frontend: {
      scriptModules: frontendModules
    },
    play: {
      unitTests: playTests.count,
      testFiles: playTests.files
    },
    docs: {
      trustedBetaPlan: "docs/TRUSTED_BETA_ZH.md",
      securityTesting: "SECURITY_AND_TESTING.md"
    }
  };

  const outPath = join(root, "docs", "GENERATED_PROJECT_STATUS.json");
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Generated ${outPath}`);
  console.log(
    `  backend tests: ${backendTests.count} (${backendTests.files} files) · schema markers: ${schemaRoutes} · migrations: ${migrations.count} (${migrations.latest})`
  );
  console.log(`  play tests: ${playTests.count} · frontend modules: ${frontendModules}`);
}

main();
