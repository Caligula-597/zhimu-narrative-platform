#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shouldBuild = process.argv.includes("--build");
const npmCommand = process.env.npm_execpath ? process.execPath : "npm";
const npmPrefixArgs = process.env.npm_execpath ? [process.env.npm_execpath] : [];

function runBuild(args, cwd = root) {
  const result = spawnSync(npmCommand, [...npmPrefixArgs, ...args], {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
    env: process.env
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(result.status || 1);
  }
}

if (shouldBuild) {
  runBuild(["run", "build"]);
  runBuild(["run", "build"], path.join(root, "host"));
  runBuild(["run", "build"], path.join(root, "play"));
}

function htmlAsset(directory, pattern) {
  const html = fs.readFileSync(path.join(directory, "index.html"), "utf8");
  const matches = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  const relative = matches.find((entry) => pattern.test(entry));
  if (!relative) throw new Error(`Cannot resolve ${pattern} from ${directory}/index.html`);
  return path.join(directory, relative.replace(/^\//, ""));
}

function matchingAsset(directory, pattern) {
  const assetDirectory = path.join(directory, "assets");
  const name = fs.readdirSync(assetDirectory).find((entry) => pattern.test(entry));
  if (!name) throw new Error(`Cannot resolve ${pattern} from ${assetDirectory}`);
  return path.join(assetDirectory, name);
}

const surfaces = {
  app: path.join(root, "dist"),
  host: path.join(root, "host", "dist"),
  play: path.join(root, "play", "dist")
};

const checks = [
  ["app-entry-js", htmlAsset(surfaces.app, /assets\/index-[^/]+\.js$/), 85 * 1024],
  ["app-entry-css", htmlAsset(surfaces.app, /assets\/index-[^/]+\.css$/), 32 * 1024],
  ["host-entry-js", htmlAsset(surfaces.host, /assets\/index-[^/]+\.js$/), 45 * 1024],
  ["host-entry-css", htmlAsset(surfaces.host, /assets\/index-[^/]+\.css$/), 38 * 1024],
  ["play-entry-js", htmlAsset(surfaces.play, /assets\/index-[^/]+\.js$/), 65 * 1024],
  ["play-entry-css", htmlAsset(surfaces.play, /assets\/index-[^/]+\.css$/), 12 * 1024],
  ["play-livekit-lazy", matchingAsset(path.join(surfaces.play), /^livekit-vendor-[^/]+\.js$/), 145 * 1024]
];

let failed = false;
for (const [name, file, budget] of checks) {
  const raw = fs.readFileSync(file);
  const gzipBytes = gzipSync(raw, { level: 9 }).length;
  const ok = gzipBytes <= budget;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${(gzipBytes / 1024).toFixed(1)} KiB gzip / ${(budget / 1024).toFixed(0)} KiB budget`);
  if (!ok) failed = true;
}

if (failed) process.exitCode = 1;
