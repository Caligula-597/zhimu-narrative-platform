#!/usr/bin/env node
/**
 * Encoding-safe zhimuFormat consumer migration.
 *
 * PowerShell text rewrites can corrupt UTF-8-heavy view files on Windows. This
 * script uses a fatal UTF-8 decoder, preserves existing text bytes as Unicode,
 * and syntax-checks each changed module before leaving the change in place.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");
const formatPath = path.join(srcRoot, "utils", "format.js");
const decoder = new TextDecoder("utf-8", { fatal: true });
const dryRun = process.argv.includes("--check") || process.argv.includes("--dry-run");

function listJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

function readUtf8(file) {
  const bytes = fs.readFileSync(file);
  return decoder.decode(bytes).replace(/^\uFEFF/, "");
}

function checkSyntax(file, source = null) {
  if (source == null) {
    const result = spawnSync(process.execPath, ["--check", file], { cwd: root, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`${file}\n${result.stderr || result.stdout}`);
    return;
  }
  const tmpRoot = path.join(root, "tmp");
  fs.mkdirSync(tmpRoot, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(tmpRoot, "format-migration-check-"));
  try {
    const tmp = path.join(tmpDir, `${path.basename(file)}.mjs`);
    fs.writeFileSync(tmp, source, "utf8");
    const result = spawnSync(process.execPath, ["--check", tmp], { cwd: root, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`${file}\n${result.stderr || result.stdout}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function importPathFor(file) {
  let rel = path.relative(path.dirname(file), formatPath).replace(/\\/g, "/");
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

function transform(file, source) {
  const specifier = importPathFor(file);
  let next = source;
  let usesNamespace = false;
  let usesEscape = false;

  next = next.replace(/^\s*const F = window\.zhimuFormat \|\| \{\};\r?\n/m, () => {
    usesNamespace = true;
    return "";
  });

  next = next.replace(/^\s*const escapeHtml = window\.zhimuFormat\?\.escapeHtml[^\n]*\r?\n/m, () => {
    usesEscape = true;
    return "";
  });

  if (usesNamespace) {
    next = insertImport(next, `import * as F from "${specifier}";`, specifier);
  }
  if (usesEscape) {
    next = insertImport(next, `import { escapeHtml } from "${specifier}";`, specifier);
  }
  return next;
}

const candidates = listJsFiles(srcRoot)
  .filter((file) => file !== formatPath)
  .filter((file) => readUtf8(file).includes("window.zhimuFormat"));

const changed = [];
for (const file of candidates) {
  const before = readUtf8(file);
  checkSyntax(file);
  const after = transform(file, before);
  if (after === before) continue;
  checkSyntax(file, after);
  changed.push(path.relative(root, file).replace(/\\/g, "/"));
  if (!dryRun) fs.writeFileSync(file, after, "utf8");
}

if (dryRun) {
  console.log(`[migrate-format-bridge] would change ${changed.length} files`);
} else {
  console.log(`[migrate-format-bridge] changed ${changed.length} files`);
}
for (const file of changed) console.log(`- ${file}`);
