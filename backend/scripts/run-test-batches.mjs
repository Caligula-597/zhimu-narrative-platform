import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "test");
const cwd = join(root, "..");
const files = readdirSync(root)
  .filter((name) => name.endsWith(".test.js"))
  .sort();

const timeoutMs = Number(process.env.TEST_FILE_TIMEOUT_MS ?? 120_000);
const startFrom = Number(process.env.TEST_BATCH_START ?? 0);

function runOne(file) {
  const full = join(root, file);
  return new Promise((resolve) => {
    const started = Date.now();
    // hooks.mjs owns teardown; forcing exit can race handles already closing.
    const child = spawn(
      process.execPath,
      ["--test-concurrency=1", "--import", "./test/hooks.mjs", "--test-reporter=spec", full],
      { cwd, stdio: ["ignore", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000);
      resolve({ file, status: "TIMEOUT", elapsed: timeoutMs, stdout, stderr });
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        file,
        status: code === 0 ? "PASS" : "FAIL",
        code,
        elapsed: Date.now() - started,
        stdout,
        stderr
      });
    });
  });
}

const summary = [];

for (let i = startFrom; i < files.length; i++) {
  const file = files[i];
  console.log(`\n[${i + 1}/${files.length}] ${file}`);
  const result = await runOne(file);
  summary.push(result);
  const sec = (result.elapsed / 1000).toFixed(1);
  console.log(`→ ${result.status} (${sec}s)\n`);
}

console.log("\n=== SUMMARY ===");
for (const row of summary) {
  console.log(`${row.status.padEnd(7)} ${row.file} (${(row.elapsed / 1000).toFixed(1)}s)`);
}

const bad = summary.filter((r) => r.status !== "PASS");
process.exit(bad.length ? 1 : 0);
