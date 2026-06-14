#!/usr/bin/env node
/** git push (or other git args) via Clash — usage: node scripts/git-push.mjs [git args…] */
import { spawnSync } from "node:child_process";
import { applyClashProxyEnv } from "./clash-proxy.mjs";

const proxy = applyClashProxyEnv();
const gitArgs = process.argv.slice(2);
if (!gitArgs.length) gitArgs.push("push");

const result = spawnSync("git", gitArgs, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
