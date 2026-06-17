#!/usr/bin/env node
/**
 * Print OAuth callback URLs and whether backend/.env has credentials.
 * Usage:
 *   npm run oauth:check
 *   node scripts/check-oauth-config.mjs --production
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, "backend", ".env");
const productionOnly = process.argv.includes("--production");

function parseEnv(content) {
  const out = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, "utf8")) : {};
const localUrl = (env.APP_PUBLIC_URL || "http://localhost:4173").replace(/\/$/, "");
const prodUrl = (
  process.env.RAILWAY_APP_PUBLIC_URL ||
  env.RAILWAY_APP_PUBLIC_URL ||
  "https://app.getzhimu.com"
).replace(/\/$/, "");

function printBlock(label, publicUrl) {
  console.log(`\n=== ${label} ===`);
  console.log(`APP_PUBLIC_URL: ${publicUrl}\n`);
  for (const id of ["google", "github"]) {
    const upper = id.toUpperCase();
    const idSet = Boolean(env[`${upper}_CLIENT_ID`]?.trim());
    const secretSet = Boolean(env[`${upper}_CLIENT_SECRET`]?.trim());
    const callback = `${publicUrl}/api/auth/oauth/${id}/callback`;
    const ok = idSet && secretSet;
    console.log(`${id.toUpperCase()}: ${ok ? "✅ 凭证已填（backend/.env）" : "❌ 缺 CLIENT_ID 或 CLIENT_SECRET"}`);
    console.log(`  回调 URL → 填到 ${id === "google" ? "Google Console Redirect URIs" : "GitHub Authorization callback URL"}:`);
    console.log(`  ${callback}`);
    if (id === "google") {
      console.log(`  Authorized JavaScript origins → ${publicUrl}`);
    }
  }
}

console.log("织幕 OAuth 配置检查");

if (productionOnly) {
  printBlock("生产（Railway · app.getzhimu.com）", prodUrl);
} else {
  printBlock("本地开发", localUrl);
  printBlock("生产（Railway · 分域后应用域名）", prodUrl);
}

console.log("\n--- 必做（分域后）---");
console.log("1. Google / GitHub OAuth 控制台：登记上方「生产」回调 URL（可保留旧 getzhimu.com 条目）");
console.log("2. npm run railway:sync-env && npm run railway:push-env  # 推送 GOOGLE_* / GITHUB_* 到 Railway");
console.log("3. 验收: https://app.getzhimu.com/api/auth/config → oauth 非空且 oauthDiagnostics.ready === true");
console.log("\n详见 docs/ops/OAUTH_SETUP.md");
