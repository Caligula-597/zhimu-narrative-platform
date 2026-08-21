#!/usr/bin/env node
/** Fail when production JS/CSS is no longer reachable from a shipped entry. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["frontend", "src", "shared", "play/src", "host/src", "backend/src"];
const explicitFiles = [
  "app.js",
  "config.js",
  "rule-visual.js",
  "styles.css",
  "server.js",
  "site/main.js",
  "site/pricing-commercial.js",
  "site/styles.css"
];
const entries = [
  "frontend/main.js",
  "styles.css",
  "play/src/main.js",
  "host/src/main.js",
  "site/main.js",
  "site/pricing-commercial.js",
  "site/styles.css",
  "backend/src/server.js",
  "server.js"
];
const sourceExtension = /\.(?:js|mjs|css)$/;
const dependencyPatterns = [
  /(?:import\s+(?:[^'";]*?\s+from\s+)?|export\s+[^'";]*?\s+from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g,
  /@import\s+(?:url\()?\s*['"]([^'"]+)['"]/g
];

const normalize = (value) => value.split(path.sep).join("/");

function walk(directory, output = []) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return output;
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = normalize(path.join(directory, entry.name));
    if (entry.isDirectory()) walk(relative, output);
    else if (sourceExtension.test(relative)) output.push(relative);
  }
  return output;
}

const files = new Set([
  ...sourceRoots.flatMap((directory) => walk(directory)),
  ...explicitFiles.filter((file) => fs.existsSync(path.join(root, file)))
]);

function resolveLocalImport(from, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(root, path.dirname(from), specifier);
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}.css`, path.join(base, "index.js")];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
    return normalize(path.relative(root, candidate));
  }
  return null;
}

const dependencies = new Map();
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const localDependencies = [];
  for (const pattern of dependencyPatterns) {
    for (const match of source.matchAll(pattern)) {
      const resolved = resolveLocalImport(file, match[1]);
      if (resolved && files.has(resolved)) localDependencies.push(resolved);
    }
  }
  dependencies.set(file, localDependencies);
}

const reachable = new Set();
const pending = entries.filter((entry) => files.has(entry));
while (pending.length) {
  const file = pending.pop();
  if (reachable.has(file)) continue;
  reachable.add(file);
  pending.push(...(dependencies.get(file) || []));
}

const unreachable = [...files].filter((file) => !reachable.has(file)).sort();
if (unreachable.length) {
  console.error(`unreachable production source (${unreachable.length}):`);
  unreachable.forEach((file) => console.error(`  - ${file}`));
  console.error("Delete the abandoned module or add its real production entry to audit-source-reachability.mjs.");
  process.exit(1);
}

console.log(`source reachability passed: ${reachable.size}/${files.size} production JS/CSS files reachable`);
