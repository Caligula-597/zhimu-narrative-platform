#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(root, "site");
const distDir = path.join(siteDir, "dist");

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npm", ["ci"], siteDir);
run("npm", ["run", "build"], siteDir);
fs.writeFileSync(path.join(distDir, "_redirects"), "/* /index.html 200\n");
console.log("[build] site/dist ready");
