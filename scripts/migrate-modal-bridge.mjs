#!/usr/bin/env node
/**
 * Encoding-safe zhimuModal consumer migration.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");
const modalPath = path.join(srcRoot, "components", "modal.js");
const decoder = new TextDecoder("utf-8", { fatal: true });
const dryRun = process.argv.includes("--check") || process.argv.includes("--dry-run");

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
  let rel = path.relative(path.dirname(file), modalPath).replace(/\\/g, "/");
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
  const tmpDir = fs.mkdtempSync(path.join(tmpRoot, "modal-migration-check-"));
  try {
    const tmp = path.join(tmpDir, `${path.basename(file)}.mjs`);
    fs.writeFileSync(tmp, source, "utf8");
    const result = spawnSync(process.execPath, ["--check", tmp], { cwd: root, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`${file}\n${result.stderr || result.stdout}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function namedImports(source) {
  const names = new Set();
  const patterns = [
    [/const\s+closeModal\s*=\s*window\.zhimuModal\?\.closeModal(?:\s*\|\|\s*\(\(\)\s*=>\s*\{\}\))?;?/g, "closeModal"],
    [/const\s+studioField\s*=\s*window\.zhimuModal\?\.studioField(?:\s*\|\|\s*\(\(\)\s*=>\s*""\))?;?/g, "studioField"],
    [/const\s+studioValues\s*=\s*\(\)\s*=>\s*window\.zhimuModal\?\.studioValues\?\.\(\)\s*\|\|\s*\{\};?/g, "studioValues"]
  ];
  let next = source;
  for (const [pattern, name] of patterns) {
    next = next.replace(pattern, () => {
      names.add(name);
      return "";
    });
  }
  next = next.replace(/window\.zhimuModal\?\.closeModal\?\.\(\)/g, () => {
    names.add("closeModal");
    return "closeModal()";
  });
  next = next.replace(/window\.zhimuModal\.closeModal\(\)/g, () => {
    names.add("closeModal");
    return "closeModal()";
  });
  return { source: next, names };
}

function transform(file, source) {
  const specifier = specifierFor(file);
  let next = source;
  let namespace = false;
  next = next.replace(/^\s*const M = window\.zhimuModal \|\| \{\};\r?\n/m, () => {
    namespace = true;
    return "";
  });

  const named = namedImports(next);
  next = named.source;

  if (namespace) next = insertImport(next, `import * as M from "${specifier}";`, specifier);
  if (named.names.size) {
    const names = [...named.names].sort().join(", ");
    next = insertImport(next, `import { ${names} } from "${specifier}";`, specifier);
  }
  return next;
}

const candidates = walk(srcRoot)
  .filter((file) => file !== modalPath)
  .filter((file) => readUtf8(file).includes("zhimuModal"));

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

console.log(`[migrate-modal-bridge] ${dryRun ? "would change" : "changed"} ${changed.length} files`);
for (const file of changed) console.log(`- ${file}`);
