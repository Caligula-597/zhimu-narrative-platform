#!/usr/bin/env node
/**
 * Verify frontend source files are UTF-8 decodable and syntactically valid.
 *
 * This is intentionally small and dependency-free so it can run before/after
 * mechanical migrations. It catches the Windows text-rewrite failure mode where
 * UTF-8-heavy view files are accidentally rewritten with the wrong encoding.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");
const decoder = new TextDecoder("utf-8", { fatal: true });

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(full);
  }
  return files;
}

const failures = [];
const files = walk(srcRoot);
for (const file of files) {
  try {
    decoder.decode(fs.readFileSync(file));
  } catch (error) {
    failures.push(`${path.relative(root, file)}: invalid UTF-8 (${error.message})`);
    continue;
  }
  const result = spawnSync(process.execPath, ["--check", file], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    failures.push(`${path.relative(root, file)}: syntax check failed\n${result.stderr || result.stdout}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`source encoding check: OK (${files.length} src js files)`);
