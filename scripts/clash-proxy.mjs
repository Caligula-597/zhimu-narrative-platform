/** Clash HTTP proxy for git / gh — no global git config required. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localEnvFile = path.join(root, "config", "clash-proxy.env");
const DEFAULT_PROXY = "http://127.0.0.1:7890";

function readLocalProxyFile() {
  if (!fs.existsSync(localEnvFile)) return null;
  for (const line of fs.readFileSync(localEnvFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^ZHIMU_CLASH_HTTP_PROXY=(.+)$/);
    if (match) return match[1].trim();
  }
  return null;
}

export function clashProxyUrl() {
  return (
    process.env.ZHIMU_CLASH_HTTP_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    readLocalProxyFile() ||
    DEFAULT_PROXY
  );
}

export function applyClashProxyEnv() {
  const proxy = clashProxyUrl();
  process.env.HTTP_PROXY = proxy;
  process.env.HTTPS_PROXY = proxy;
  process.env.ALL_PROXY = proxy;
  process.env.http_proxy = proxy;
  process.env.https_proxy = proxy;
  return proxy;
}
