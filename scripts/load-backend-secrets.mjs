import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Load selected keys from backend/.env into process.env (does not overwrite existing). */
export function loadBackendSecrets(keys = []) {
  const envPath = path.join(root, "backend", ".env");
  const out = { ...process.env };
  if (!fs.existsSync(envPath)) return out;
  const wanted = new Set(keys);
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    if (!wanted.has(key)) continue;
    if (!out[key]) {
      out[key] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

export function backendRoot() {
  return path.join(root, "backend");
}

export function repoRoot() {
  return root;
}
