#!/usr/bin/env node
/**
 * Encoding-safe zhimuUi producer/consumer migration.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");
const uiPath = path.join(srcRoot, "components", "emptyState.js");
const decoder = new TextDecoder("utf-8", { fatal: true });
const dryRun = process.argv.includes("--check") || process.argv.includes("--dry-run");

const exportedUiFunctions = [
  "activeRuntimeRoom",
  "canEditWorldContent",
  "catalogExperienceBanner",
  "isWorldOwner",
  "deleteWorldPanel",
  "runtimeEmpty",
  "cloudStatus",
  "stat",
  "flow",
  "activity",
  "readingRow",
  "task",
  "taskAction",
  "capability",
  "catalogPromoSection",
  "creatorWorkspaceEmpty",
  "check",
  "voiceOption"
];

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(full);
  }
  return files;
}

function readUtf8(file) {
  return decoder.decode(fs.readFileSync(file)).replace(/^\uFEFF/, "");
}

function specifierFor(file) {
  let rel = path.relative(path.dirname(file), uiPath).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

function hasImport(source, specifier) {
  return source.includes(`from "${specifier}"`) || source.includes(`from '${specifier}'`);
}

function insertImport(source, statement, specifier) {
  if (hasImport(source, specifier)) return source;
  const lines = source.split(/\r?\n/);
  let lastImport = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^import\s/.test(lines[i])) lastImport = i;
    else if (lastImport >= 0 && lines[i].trim() !== "") break;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, statement);
    return lines.join("\n");
  }
  return `${statement}\n${source}`;
}

function checkSyntax(file, source = null) {
  if (source == null) {
    const result = spawnSync(process.execPath, ["--check", file], { cwd: root, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`${file}\n${result.stderr || result.stdout}`);
    return;
  }
  const tmpRoot = path.join(root, "tmp");
  fs.mkdirSync(tmpRoot, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(tmpRoot, "ui-migration-check-"));
  try {
    const tmp = path.join(tmpDir, `${path.basename(file)}.mjs`);
    fs.writeFileSync(tmp, source, "utf8");
    const result = spawnSync(process.execPath, ["--check", tmp], { cwd: root, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`${file}\n${result.stderr || result.stdout}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function transformProducer(source) {
  let next = source;
  next = next.replace(/\(function \(window\) \{\r?\n/, "");
  next = next.replace(/^\s*const U = window\.zhimuUi \|\| \{\};\r?\n/m, "");
  for (const name of exportedUiFunctions) {
    next = next.replace(new RegExp(`^\\s*function ${name}\\b`, "m"), `export function ${name}`);
  }
  next = next.replace(
    /\r?\n\s*window\.zhimuUi = \{[\s\S]*?\};\r?\n\}\)\(window\);\r?\nexport \{\};\r?\n?$/,
    "\n"
  );
  return next;
}

function transformConsumer(file, source) {
  const specifier = specifierFor(file);
  let next = source;
  let namespace = false;
  const named = new Set();

  next = next.replace(/^\s*const U = window\.zhimuUi \|\| \{\};\r?\n/m, () => {
    namespace = true;
    return "";
  });
  next = next.replace(/window\.zhimuUi\.activeRuntimeRoom\?\.\(\)/g, () => {
    named.add("activeRuntimeRoom");
    return "activeRuntimeRoom()";
  });
  next = next.replace(/window\.zhimuUi\.activeRuntimeRoom\(\)/g, () => {
    named.add("activeRuntimeRoom");
    return "activeRuntimeRoom()";
  });
  next = next.replace(/window\.zhimuUi\?\.activeRuntimeRoom\?\.\(\)\?\.invite_code/g, () => {
    named.add("activeRuntimeRoom");
    return "activeRuntimeRoom()?.invite_code";
  });
  next = next.replace(/window\.zhimuUi\?\.activeRuntimeRoom\?\.\(\) \?\? workspaceActiveRuntimeRoom\(\) \?\? null/g, "workspaceActiveRuntimeRoom() ?? null");

  if (namespace) next = insertImport(next, `import * as U from "${specifier}";`, specifier);
  if (named.size) {
    const names = [...named].sort().join(", ");
    next = insertImport(next, `import { ${names} } from "${specifier}";`, specifier);
  }
  return next;
}

const changed = [];
const beforeProducer = readUtf8(uiPath);
checkSyntax(uiPath);
const afterProducer = transformProducer(beforeProducer);
if (afterProducer !== beforeProducer) {
  checkSyntax(uiPath, afterProducer);
  changed.push(path.relative(root, uiPath).replace(/\\/g, "/"));
  if (!dryRun) fs.writeFileSync(uiPath, afterProducer, "utf8");
}

for (const file of walk(srcRoot).filter((candidate) => candidate !== uiPath)) {
  const before = readUtf8(file);
  if (!before.includes("zhimuUi")) continue;
  checkSyntax(file);
  const after = transformConsumer(file, before);
  if (after === before) continue;
  checkSyntax(file, after);
  changed.push(path.relative(root, file).replace(/\\/g, "/"));
  if (!dryRun) fs.writeFileSync(file, after, "utf8");
}

console.log(`[migrate-ui-bridge] ${dryRun ? "would change" : "changed"} ${changed.length} files`);
for (const file of changed) console.log(`- ${file}`);
