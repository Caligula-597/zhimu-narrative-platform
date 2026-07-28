#!/usr/bin/env node
/**
 * Keep the production R2 browser-upload CORS rule aligned with all three
 * application portals. Existing unrelated bucket rules are preserved.
 *
 * Usage:
 *   npm run cloudflare:sync-r2-cors
 *   npm run cloudflare:sync-r2-cors -- --check
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cfRequest, verifyToken } from "./cloudflare-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");
const managedRuleId = "zhimu-browser-upload";
const defaultOrigins = [
  "https://app.getzhimu.com",
  "https://host.getzhimu.com",
  "https://play.getzhimu.com"
];

function readEnvFile(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\""))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function loadConfiguration() {
  return {
    ...readEnvFile(path.join(root, ".env.railway.setup")),
    ...readEnvFile(path.join(root, "backend", ".env")),
    ...process.env
  };
}

function configuredOrigins(env) {
  const raw = env.R2_CORS_ORIGINS?.trim();
  const origins = raw
    ? raw.split(",").map((value) => value.trim()).filter(Boolean)
    : defaultOrigins;
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`Invalid R2 CORS origin: ${origin}`);
    }
  }
  return [...new Set(origins)];
}

function ruleCoversBrowserUploads(rule, origins) {
  const allowed = rule?.allowed || {};
  const allowedOrigins = new Set(allowed.origins || []);
  const allowedMethods = new Set(allowed.methods || []);
  const allowedHeaders = new Set((allowed.headers || []).map((header) => header.toLowerCase()));
  return origins.every((origin) => allowedOrigins.has(origin))
    && allowedMethods.has("PUT")
    && (allowedHeaders.has("content-type") || allowedHeaders.has("*"));
}

async function getCorsPolicy(token, corsPath) {
  try {
    return await cfRequest(token, corsPath);
  } catch (error) {
    if (/cors configuration does not exist|not found/iu.test(error.message || "")) {
      return { rules: [] };
    }
    throw error;
  }
}

async function main() {
  const env = loadConfiguration();
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  const accountId = (env.CLOUDFLARE_ACCOUNT_ID || env.R2_ACCOUNT_ID)?.trim();
  const bucket = env.R2_BUCKET?.trim();
  if (!token) throw new Error("Missing CLOUDFLARE_API_TOKEN");
  if (!accountId) throw new Error("Missing CLOUDFLARE_ACCOUNT_ID or R2_ACCOUNT_ID");
  if (!bucket) throw new Error("Missing R2_BUCKET");

  await verifyToken(token);
  const corsPath = `/accounts/${encodeURIComponent(accountId)}/r2/buckets/${encodeURIComponent(bucket)}/cors`;
  const current = await getCorsPolicy(token, corsPath);
  const rules = Array.isArray(current?.rules) ? current.rules : [];
  const origins = configuredOrigins(env);

  if (checkOnly) {
    if (!rules.some((rule) => ruleCoversBrowserUploads(rule, origins))) {
      throw new Error(`R2 CORS is missing browser PUT access for: ${origins.join(", ")}`);
    }
    console.log(`R2 CORS verified for ${origins.length} portal origins.`);
    return;
  }

  const managedRule = {
    id: managedRuleId,
    allowed: {
      origins,
      methods: ["PUT"],
      headers: ["Content-Type"]
    },
    exposeHeaders: ["ETag"],
    maxAgeSeconds: 3600
  };
  const nextRules = [
    ...rules.filter((rule) => rule?.id !== managedRuleId),
    managedRule
  ];
  await cfRequest(token, corsPath, {
    method: "PUT",
    body: { rules: nextRules }
  });

  const verified = await getCorsPolicy(token, corsPath);
  if (!(verified?.rules || []).some((rule) => ruleCoversBrowserUploads(rule, origins))) {
    throw new Error("R2 CORS update returned without the required browser-upload rule");
  }
  console.log(`R2 CORS synchronized for ${origins.length} portal origins.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
