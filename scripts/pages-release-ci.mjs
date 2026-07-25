#!/usr/bin/env node
/**
 * Build once, deploy every Pages surface to an immutable preview, smoke the
 * previews, then promote the exact same dist directories to production.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const prepareOnly = args.has("--prepare");
const promoteOnly = args.has("--promote");
if (prepareOnly && promoteOnly) throw new Error("Choose only one of --prepare or --promote");
const sha = String(process.env.RELEASE_SHA || process.env.GITHUB_SHA || "").trim();
if (!/^[a-f0-9]{7,40}$/i.test(sha)) {
  throw new Error("RELEASE_SHA/GITHUB_SHA must be a commit SHA");
}
const previewBranch = `release-${sha.slice(0, 12).toLowerCase()}`;
const commonEnv = {
  ...process.env,
  VITE_API_ORIGIN: "https://app.getzhimu.com",
  VITE_APP_ORIGIN: "https://app.getzhimu.com",
  VITE_PLAY_ORIGIN: "https://play.getzhimu.com"
};
const targets = [
  {
    name: "site",
    project: "zhimu-site",
    directory: "site",
    productionUrl: "https://getzhimu.com",
    markers: ["zhimu", "织幕", "剧本"]
  },
  {
    name: "play",
    project: "zhimu-play",
    directory: "play",
    productionUrl: "https://play.getzhimu.com",
    markers: ["zhimu", "织幕", "玩家", "play"]
  },
  {
    name: "host",
    project: "zhimu-host",
    directory: "host",
    productionUrl: "https://host.getzhimu.com",
    markers: ["zhimu", "织幕", "主持", "host"]
  }
];

function run(command, args, { cwd = root, capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: commonEnv,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: process.platform === "win32"
  });
  if (capture) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

async function smokeSurface(target, url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(20_000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${target.name} preview returned ${response.status}: ${url}`);

  const csp = response.headers.get("content-security-policy") || "";
  const hsts = response.headers.get("strict-transport-security") || "";
  const frameProtection = response.headers.get("x-frame-options") || csp;
  if (!csp.includes("require-trusted-types-for 'script'")
    || !csp.includes("frame-ancestors 'none'")
    || !/max-age=/i.test(hsts)
    || !/(DENY|frame-ancestors 'none')/i.test(frameProtection)) {
    throw new Error(`${target.name} security headers are incomplete at ${url}`);
  }

  const lower = text.toLowerCase();
  if (!target.markers.some((marker) => lower.includes(marker.toLowerCase()))) {
    throw new Error(`${target.name} content marker missing at ${url}`);
  }

  const assetUrls = [...text.matchAll(/(?:src|href)=["']([^"'#?]+\.(?:js|css))[^"']*["']/gi)]
    .map((match) => new URL(match[1], url).toString());
  for (const assetUrl of [...new Set(assetUrls)]) {
    const asset = await fetch(assetUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000)
    });
    if (!asset.ok) throw new Error(`${target.name} asset returned ${asset.status}: ${assetUrl}`);
  }
  console.log(`[pages-release] preview verified: ${target.name} ${url}`);
}

function deploy(target, branch) {
  const output = run(
    "npx",
    [
      "--yes",
      "wrangler@4.113.0",
      "pages",
      "deploy",
      "dist",
      `--project-name=${target.project}`,
      `--branch=${branch}`,
      "--commit-dirty=true"
    ],
    { cwd: path.join(root, target.directory), capture: true }
  );
  const urls = output.match(/https:\/\/[a-z0-9.-]+\.pages\.dev/gi) || [];
  return urls.at(-1) || null;
}

if (!promoteOnly) {
  for (const target of targets) {
    const cwd = path.join(root, target.directory);
    run("npm", ["ci"], { cwd });
    run("npm", ["run", "build"], { cwd });
  }

  for (const target of targets) {
    const previewUrl = deploy(target, previewBranch);
    if (!previewUrl) throw new Error(`Could not resolve ${target.name} preview URL from Wrangler output`);
    await smokeSurface(target, previewUrl);
  }
}

if (!prepareOnly) {
  console.log("[pages-release] promoting verified immutable dist directories");
  for (const target of targets) {
    deploy(target, "main");
  }

  run("node", ["scripts/pages-smoke.mjs"], { cwd: root });
  console.log(`[pages-release] production release complete for ${sha}`);
}
