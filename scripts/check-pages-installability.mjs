#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmVersion = process.env.CLOUDFLARE_NPM_VERSION || "10.9.2";
if (!/^\d+\.\d+\.\d+$/.test(npmVersion)) {
  throw new Error("CLOUDFLARE_NPM_VERSION must be an exact semver");
}

if (!process.env.npm_execpath) {
  throw new Error("Run this guard through npm run check:pages-installability");
}
const npxCli = path.join(path.dirname(process.env.npm_execpath), "npx-cli.js");
const projects = ["site", "host", "play"];

function checkProject(project) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      npxCli,
      "--yes",
      `npm@${npmVersion}`,
      "ci",
      "--dry-run",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund"
    ], {
      cwd: path.join(root, project),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", (error) => finish({ project, ok: false, output: error.message }));
    child.on("close", (status) => finish({ project, ok: status === 0, output }));
  });
}

const results = await Promise.all(projects.map(checkProject));
for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.project}: npm@${npmVersion} lockfile installability`);
  if (!result.ok) process.stderr.write(result.output.slice(-6000));
}

if (results.some((result) => !result.ok)) process.exitCode = 1;
