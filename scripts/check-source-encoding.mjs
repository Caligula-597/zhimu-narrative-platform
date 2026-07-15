#!/usr/bin/env node
/**
 * Verify production and audit source files are UTF-8 decodable, free of common
 * mojibake signatures, and syntactically valid.
 *
 * This is intentionally small and dependency-free so it can run before/after
 * mechanical migrations. It catches the Windows text-rewrite failure mode where
 * UTF-8-heavy view files are accidentally rewritten with the wrong encoding.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["src", "host/src", "play/src", "shared", "backend/src", "backend/scripts", "scripts"]
  .map((entry) => path.join(root, entry));
const decoder = new TextDecoder("utf-8", { fatal: true });
const sourceExtensions = new Set([".js", ".mjs", ".cjs"]);
const mojibakePattern = /\uFFFD|Ã.|Â.|â(?:€|™|€œ|€œ|€˜|€™)|ðŸ|锟斤拷|缁囧|鏃堕棿|閰嶇疆|鍒嗘敮|宸ヤ綔|缁撴灉|鑰楁椂|妫€鏌|瀹屾暣/u;
const requestedConcurrency = Number.parseInt(process.env.SOURCE_CHECK_CONCURRENCY || "", 10);
const syntaxConcurrency = Number.isFinite(requestedConcurrency)
  ? Math.max(1, Math.min(16, requestedConcurrency))
  : Math.max(1, Math.min(8, availableParallelism()));

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const failures = [];
const checkerPath = fileURLToPath(import.meta.url);
const files = [
  ...sourceRoots.flatMap((sourceRoot) => walk(sourceRoot)),
  path.join(root, "app.js")
];
const syntaxFiles = [];
for (const file of files) {
  try {
    const source = decoder.decode(fs.readFileSync(file));
    if (file !== checkerPath && mojibakePattern.test(source)) {
      failures.push(`${path.relative(root, file)}: probable mojibake text`);
    }
  } catch (error) {
    failures.push(`${path.relative(root, file)}: invalid UTF-8 (${error.message})`);
    continue;
  }
  syntaxFiles.push(file);
}

async function checkSyntax(file) {
  await new Promise((resolve) => {
    const child = spawn(process.execPath, ["--check", file], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      callback();
      resolve();
    };
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", (error) => {
      finish(() => failures.push(`${path.relative(root, file)}: syntax check could not start (${error.message})`));
    });
    child.on("close", (status) => {
      finish(() => {
        if (status !== 0) failures.push(`${path.relative(root, file)}: syntax check failed\n${output}`);
      });
    });
  });
}

let nextFile = 0;
await Promise.all(Array.from({ length: Math.min(syntaxConcurrency, syntaxFiles.length) }, async () => {
  while (nextFile < syntaxFiles.length) {
    const file = syntaxFiles[nextFile];
    nextFile += 1;
    await checkSyntax(file);
  }
}));

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`source encoding check: OK (${files.length} production/audit script files, concurrency ${syntaxConcurrency})`);
