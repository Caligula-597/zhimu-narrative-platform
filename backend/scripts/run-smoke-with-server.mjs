#!/usr/bin/env node
import "dotenv/config";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafeDatabaseUrlForTestWrites } from "./lib/assert-safe-database-url.mjs";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const startupTimeoutMs = 30_000;
const shutdownTimeoutMs = 10_000;

assertSafeDatabaseUrlForTestWrites(process.env.DATABASE_URL, {
  opName: "self-contained API smoke"
});

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!port) throw new Error("Unable to reserve a smoke-test port");
  return port;
}

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }
  return new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const graceful = await Promise.race([
    waitForExit(child).then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), shutdownTimeoutMs))
  ]);
  if (!graceful && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await waitForExit(child);
  }
}

async function waitForHealth(url, child, logTail) {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Smoke server exited before healthcheck\n${logTail()}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // Cold start: retry until the bounded deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Smoke server did not become healthy within ${startupTimeoutMs}ms\n${logTail()}`);
}

const port = await reservePort();
const baseUrl = `http://127.0.0.1:${port}/api`;
const childEnv = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "test",
  ALLOW_DEMO_USER_HEADER: "true",
  OBJECT_STORAGE_PROVIDER: "memory",
  RATE_LIMIT_ENABLED: "false",
  GUEST_CREATE_HOUR_MAX: "1000",
  GUEST_CREATE_DAY_MAX: "1000",
  PLAY_SOCIAL_ACCOUNT_COOLDOWN_MIN: "0",
  OFFICIAL_EXAMPLE_WORLD_ID: "33333333-3333-4333-8444-555555550003"
};

let serverLog = "";
const server = spawn(process.execPath, ["src/server.js"], {
  cwd: backendRoot,
  env: childEnv,
  stdio: ["ignore", "pipe", "pipe"],
  shell: false
});
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (chunk) => {
    const text = String(chunk);
    serverLog = `${serverLog}${text}`.slice(-16_000);
    process.stderr.write(text);
  });
}

try {
  await waitForHealth(`${baseUrl}/health`, server, () => serverLog);
  const smoke = spawn(process.execPath, ["scripts/smoke-api.js"], {
    cwd: backendRoot,
    env: { ...childEnv, SMOKE_API_BASE_URL: baseUrl },
    stdio: "inherit",
    shell: false
  });
  const result = await waitForExit(smoke);
  if (result.code !== 0) process.exitCode = result.code ?? 1;
} finally {
  await stopChild(server);
}
