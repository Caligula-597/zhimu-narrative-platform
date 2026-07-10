#!/usr/bin/env node
/**
 * Run guardian-poll on an interval (for local/staging watchdog or systemd).
 *
 * Usage:
 *   npm run guardian:scheduler
 *   GUARDIAN_INTERVAL_MS=900000 npm run guardian:scheduler -- --url http://localhost:4180 --product-probes
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const intervalMs = Math.max(60_000, Number(process.env.GUARDIAN_INTERVAL_MS || 15 * 60 * 1000));
const pollArgs = process.argv.slice(2);
let running = false;
let timer = null;

function runOnce() {
  if (running) {
    console.warn("[guardian-scheduler] previous poll still running, skip tick");
    return;
  }
  running = true;
  const started = new Date().toISOString();
  console.log(`\n[guardian-scheduler] tick ${started}`);
  const child = spawn(process.execPath, ["scripts/guardian-poll.mjs", ...pollArgs], {
    cwd: root,
    stdio: "inherit",
    env: process.env
  });
  child.on("exit", (code) => {
    running = false;
    if (code) console.error(`[guardian-scheduler] poll exit ${code}`);
  });
}

console.log(`Guardian scheduler every ${Math.round(intervalMs / 1000)}s`);
runOnce();
timer = setInterval(runOnce, intervalMs);

process.on("SIGINT", () => {
  clearInterval(timer);
  process.exit(0);
});
