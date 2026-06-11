#!/usr/bin/env node
/**
 * Print OAuth callback URLs and whether backend/.env has credentials.
 * Usage: npm run oauth:check
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, "backend", ".env");

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
const publicUrl = (env.APP_PUBLIC_URL || "https://getzhimu.com").replace(/\/$/, "");

console.log("织幕 OAuth 配置检查\n");
console.log(`APP_PUBLIC_URL: ${publicUrl}\n`);

for (const id of ["google", "github"]) {
  const upper = id.toUpperCase();
  const idSet = Boolean(env[`${upper}_CLIENT_ID`]?.trim());
  const secretSet = Boolean(env[`${upper}_CLIENT_SECRET`]?.trim());
  const callback = `${publicUrl}/api/auth/oauth/${id}/callback`;
  const ok = idSet && secretSet;
  console.log(`${id.toUpperCase()}: ${ok ? "✅ 凭证已填" : "❌ 缺 CLIENT_ID 或 CLIENT_SECRET"}`);
  console.log(`  回调 URL（填到 ${id === "google" ? "Google Console" : "GitHub OAuth App"}）:`);
  console.log(`  ${callback}\n`);
}

if (!env.APP_PUBLIC_URL?.trim()) {
  console.warn("提示: backend/.env 未设 APP_PUBLIC_URL，上面回调 URL 使用默认 getzhimu.com");
}

console.log("生产验收: curl https://getzhimu.com/api/auth/config");
console.log("  → oauthDiagnostics.ready 应为 true，oauth 数组非空");
