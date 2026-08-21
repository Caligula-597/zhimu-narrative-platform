/**
 * Generate a machine-readable project baseline.
 *
 * Usage:
 *   npm run status:generate
 *   node scripts/generate-project-status.mjs --check
 *
 * The generated file is the source for volatile documentation numbers. Human
 * documents should explain meaning and link here instead of copying totals.
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(root, "docs", "GENERATED_PROJECT_STATUS.json");
const checkOnly = process.argv.includes("--check");

function listFiles(directory, predicate) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) return listFiles(absolute, predicate);
      return predicate(absolute) ? [absolute] : [];
    })
    .sort();
}

function countTestDeclarations(directory, extensionPattern) {
  const files = listFiles(directory, (file) => extensionPattern.test(file));
  let declarations = 0;
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    declarations += (source.match(/^\s*(?:test|it)\s*\(/gm) ?? []).length;
  }
  return { declarations, files: files.length };
}

function countMigrations() {
  const files = listFiles(join(root, "backend", "migrations"), (file) => file.endsWith(".sql"));
  return {
    count: files.length,
    latest: files.at(-1)?.split(/[\\/]/).at(-1)?.replace(/\.sql$/, "") ?? null
  };
}

function countFrontendModules() {
  const result = spawnSync(process.execPath, ["scripts/verify-script-load.mjs"], {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status !== 0) return null;
  return (result.stdout || "").split(/\r?\n/).filter((line) => line.startsWith("OK")).length;
}

function gitOutput(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function lineCount(relativePath) {
  const source = readFileSync(join(root, relativePath), "utf8");
  return source.split(/\r?\n/).length;
}

function routeMetrics() {
  const directory = join(root, "backend", "src", "routes");
  const files = readdirSync(directory)
    .filter((name) => name.endsWith("-routes.js"))
    .sort();
  let directDatabaseCalls = 0;
  for (const file of files) {
    const source = readFileSync(join(directory, file), "utf8");
    directDatabaseCalls += (source.match(/(?:\bquery|client\.query)\s*\(/g) ?? []).length;
  }
  return { modules: files.length, directDatabaseCalls };
}

function schemaMetrics() {
  const files = listFiles(
    join(root, "backend", "src", "routes", "schemas"),
    (file) => file.endsWith(".js")
  );
  return { domainFiles: files.length };
}

function markdownMetrics() {
  const tracked = gitOutput([
    "-c",
    "core.quotepath=false",
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    "*.md"
  ])
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => existsSync(join(root, file)));
  const byArea = {};
  for (const file of tracked) {
    const normalized = file.replaceAll("\\", "/");
    const area = normalized.includes("/") ? normalized.split("/")[0] : "root";
    byArea[area] = (byArea[area] || 0) + 1;
  }
  return {
    trackedFiles: tracked.length,
    byArea: Object.fromEntries(Object.entries(byArea).sort(([a], [b]) => a.localeCompare(b)))
  };
}

function buildPayload() {
  const migrations = countMigrations();
  const backendTests = countTestDeclarations(
    join(root, "backend", "test"),
    /\.test\.js$/
  );
  const rootTests = countTestDeclarations(
    join(root, "scripts"),
    /\.test\.mjs$/
  );
  const playTests = countTestDeclarations(
    join(root, "play", "test"),
    /\.test\.mjs$/
  );
  const hostTests = countTestDeclarations(
    join(root, "host", "test"),
    /\.test\.mjs$/
  );
  return {
    generatedAt: new Date().toISOString(),
    source: {
      gitCommit: gitOutput(["rev-parse", "--short", "HEAD"]),
      node: process.version,
      note: "Counts describe source declarations and files, not a claim that every test was executed."
    },
    backend: {
      tests: backendTests,
      migrations: migrations.count,
      latestMigration: migrations.latest,
      routes: routeMetrics(),
      schemas: schemaMetrics()
    },
    frontend: {
      verifiedScriptModules: countFrontendModules(),
      entryLines: {
        creator: lineCount("frontend/main.js"),
        host: lineCount("host/src/main.js"),
        player: lineCount("play/src/main.js")
      },
      tests: {
        sharedAndTooling: rootTests,
        host: hostTests,
        player: playTests
      }
    },
    contracts: {
      worldWrites: 69,
      note: "Validated by npm run check:world-writes; run the command for pass/fail evidence."
    },
    documentation: markdownMetrics()
  };
}

function comparable(payload) {
  const copy = structuredClone(payload);
  delete copy.generatedAt;
  if (copy.source) delete copy.source.gitCommit;
  return copy;
}

const payload = buildPayload();
if (checkOnly) {
  if (!existsSync(outputPath)) {
    console.error(`Missing generated baseline: ${relative(root, outputPath)}`);
    process.exit(1);
  }
  const current = JSON.parse(readFileSync(outputPath, "utf8"));
  if (JSON.stringify(comparable(current)) !== JSON.stringify(comparable(payload))) {
    console.error("Generated project status is stale. Run: npm run status:generate");
    process.exit(1);
  }
  console.log(
    `project status current: migration ${payload.backend.latestMigration}, ` +
    `${payload.backend.routes.modules} route modules, ` +
    `${payload.documentation.trackedFiles} Markdown files`
  );
} else {
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Generated ${relative(root, outputPath)}`);
  console.log(
    `  migration ${payload.backend.latestMigration} (${payload.backend.migrations}) · ` +
    `${payload.backend.routes.modules} routes · ${payload.backend.schemas.domainFiles} schema files`
  );
  console.log(
    `  ${payload.documentation.trackedFiles} Markdown files · ` +
    `${payload.frontend.verifiedScriptModules ?? "unknown"} verified frontend modules`
  );
}
