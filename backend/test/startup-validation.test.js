import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateStartupEnvironment } from "../src/startup-validation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(here, "..");

test("validateStartupEnvironment rejects missing DATABASE_URL", () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  let exitCode;
  const originalExit = process.exit;
  process.exit = (code) => {
    exitCode = code;
    throw new Error("process.exit called");
  };
  try {
    assert.throws(() => validateStartupEnvironment(), /process\.exit called/);
    assert.equal(exitCode, 1);
  } finally {
    process.exit = originalExit;
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

test("validateStartupEnvironment rejects demo header in production", () => {
  const prevDb = process.env.DATABASE_URL;
  const prevEnv = process.env.NODE_ENV;
  const prevDemo = process.env.ALLOW_DEMO_USER_HEADER;
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://zhimu:replace_me@127.0.0.1:5432/zhimu";
  process.env.NODE_ENV = "production";
  process.env.ALLOW_DEMO_USER_HEADER = "true";
  let exitCode;
  const originalExit = process.exit;
  process.exit = (code) => {
    exitCode = code;
    throw new Error("process.exit called");
  };
  try {
    assert.throws(() => validateStartupEnvironment(), /process\.exit called/);
    assert.equal(exitCode, 1);
  } finally {
    process.exit = originalExit;
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
    if (prevEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevEnv;
    if (prevDemo === undefined) delete process.env.ALLOW_DEMO_USER_HEADER;
    else process.env.ALLOW_DEMO_USER_HEADER = prevDemo;
  }
});

test("validateStartupEnvironment rejects wildcard credentialed CORS in production", () => {
  const previous = {
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    corsOrigin: process.env.CORS_ORIGIN,
    demoHeader: process.env.ALLOW_DEMO_USER_HEADER
  };
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://zhimu:replace_me@127.0.0.1:5432/zhimu";
  process.env.NODE_ENV = "production";
  process.env.ALLOW_DEMO_USER_HEADER = "false";
  process.env.CORS_ORIGIN = "*";
  let exitCode;
  const originalExit = process.exit;
  process.exit = (code) => {
    exitCode = code;
    throw new Error("process.exit called");
  };
  try {
    assert.throws(() => validateStartupEnvironment(), /process\.exit called/);
    assert.equal(exitCode, 1);
  } finally {
    process.exit = originalExit;
    for (const [key, value] of [
      ["DATABASE_URL", previous.databaseUrl],
      ["NODE_ENV", previous.nodeEnv],
      ["CORS_ORIGIN", previous.corsOrigin],
      ["ALLOW_DEMO_USER_HEADER", previous.demoHeader]
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("verify-modules script passes on current tree", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-modules.mjs"], {
    cwd: backendRoot,
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || "postgres://zhimu:replace_me@127.0.0.1:5432/zhimu" }
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
  }
  assert.equal(result.status, 0, "verify-modules must pass");
});
