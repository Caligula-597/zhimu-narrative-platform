/**
 * Merge backend/.env secrets into .env.staging (staging-only keys preserved).
 * Usage: node scripts/sync-staging-env.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendEnvPath = path.join(root, "backend", ".env");
const stagingPath = path.join(root, ".env.staging");

function parseEnv(content) {
  const out = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function serializeValue(value = "") {
  const raw = String(value);
  return /[\s#"'\\]/.test(raw)
    ? `"${raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    : raw;
}

const COPY_KEYS = [
  "OBJECT_STORAGE_PROVIDER",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PUBLIC_ENDPOINT",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL",
  "DEEPSEEK_TIMEOUT_MS",
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "EMAIL_PROVIDER",
  "RESEND_API_KEY",
  "SENDGRID_API_KEY",
  "MAILGUN_API_KEY",
  "MAILGUN_DOMAIN",
  "MAILGUN_REGION",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "MAIL_REPLY_TO",
  "MAIL_FROM"
];

const backend = parseEnv(fs.readFileSync(backendEnvPath, "utf8"));
let staging = parseEnv(fs.existsSync(stagingPath) ? fs.readFileSync(stagingPath, "utf8") : "");

if (!staging.POSTGRES_PASSWORD) {
  staging.POSTGRES_PASSWORD = "zhimu_staging_local_2026";
}

for (const key of COPY_KEYS) {
  if (backend[key]) staging[key] = backend[key];
}

const prodBucket = (backend.R2_BUCKET || "").trim();
const explicitStagingBucket = (staging.R2_BUCKET_STAGING || backend.R2_BUCKET_STAGING || "").trim();
if (explicitStagingBucket) {
  staging.R2_BUCKET = explicitStagingBucket;
} else if (staging.R2_BUCKET && prodBucket && staging.R2_BUCKET !== prodBucket) {
  /* keep user override */
} else if (prodBucket) {
  staging.R2_BUCKET = `${prodBucket}-staging`;
} else {
  staging.R2_BUCKET = staging.R2_BUCKET || "zhimu-assets-staging";
}

staging.COMPOSE_PROJECT_NAME = staging.COMPOSE_PROJECT_NAME || "zhimu-staging";
staging.STAGING_HTTP_PORT = staging.STAGING_HTTP_PORT || "8080";
staging.STAGING_BASE_URL = staging.STAGING_BASE_URL || "http://localhost:8080";
staging.CORS_ORIGIN = staging.CORS_ORIGIN || "http://localhost:8080";
staging.RUN_DB_SEED = staging.RUN_DB_SEED ?? "true";
staging.VITE_REQUIRE_AUTH = staging.VITE_REQUIRE_AUTH ?? "true";
staging.VITE_DEMO_MODE = staging.VITE_DEMO_MODE ?? "false";
staging.VITE_API_BASE = staging.VITE_API_BASE || "/api";
staging.LOG_FORMAT = staging.LOG_FORMAT || "json";
staging.LOG_LEVEL = staging.LOG_LEVEL || "info";
staging.APP_PUBLIC_URL = "http://localhost:8080";
staging.DEEPSEEK_BASE_URL = staging.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
staging.DEEPSEEK_MODEL = staging.DEEPSEEK_MODEL || "deepseek-v4-flash";
staging.DEEPSEEK_TIMEOUT_MS = staging.DEEPSEEK_TIMEOUT_MS || "180000";

const lines = [
  "# Auto-synced by scripts/sync-staging-env.mjs — edit POSTGRES_PASSWORD here if you reset the PG volume",
  `COMPOSE_PROJECT_NAME=${staging.COMPOSE_PROJECT_NAME}`,
  `STAGING_HTTP_PORT=${staging.STAGING_HTTP_PORT}`,
  `STAGING_BASE_URL=${staging.STAGING_BASE_URL}`,
  `CORS_ORIGIN=${staging.CORS_ORIGIN}`,
  "",
  `POSTGRES_PASSWORD=${staging.POSTGRES_PASSWORD}`,
  `RUN_DB_SEED=${staging.RUN_DB_SEED}`,
  "",
  `VITE_REQUIRE_AUTH=${staging.VITE_REQUIRE_AUTH}`,
  `VITE_DEMO_MODE=${staging.VITE_DEMO_MODE}`,
  `VITE_API_BASE=${staging.VITE_API_BASE}`,
  "",
  `LOG_FORMAT=${staging.LOG_FORMAT}`,
  `LOG_LEVEL=${staging.LOG_LEVEL}`,
  "",
  `OBJECT_STORAGE_PROVIDER=${staging.OBJECT_STORAGE_PROVIDER || "r2"}`,
  `R2_ACCOUNT_ID=${staging.R2_ACCOUNT_ID || ""}`,
  `R2_ACCESS_KEY_ID=${staging.R2_ACCESS_KEY_ID || ""}`,
  `R2_SECRET_ACCESS_KEY=${staging.R2_SECRET_ACCESS_KEY || ""}`,
  `R2_BUCKET=${staging.R2_BUCKET || ""}`,
  `R2_PUBLIC_ENDPOINT=${staging.R2_PUBLIC_ENDPOINT || ""}`,
  "",
  `DEEPSEEK_API_KEY=${staging.DEEPSEEK_API_KEY || ""}`,
  `DEEPSEEK_BASE_URL=${staging.DEEPSEEK_BASE_URL}`,
  `DEEPSEEK_MODEL=${staging.DEEPSEEK_MODEL}`,
  `DEEPSEEK_TIMEOUT_MS=${staging.DEEPSEEK_TIMEOUT_MS}`,
  "",
  `LIVEKIT_URL=${staging.LIVEKIT_URL || ""}`,
  `LIVEKIT_API_KEY=${staging.LIVEKIT_API_KEY || ""}`,
  `LIVEKIT_API_SECRET=${staging.LIVEKIT_API_SECRET || ""}`,
  "",
  `EMAIL_PROVIDER=${staging.EMAIL_PROVIDER || "resend"}`,
  `RESEND_API_KEY=${staging.RESEND_API_KEY || ""}`,
  `SENDGRID_API_KEY=${staging.SENDGRID_API_KEY || ""}`,
  `MAILGUN_API_KEY=${staging.MAILGUN_API_KEY || ""}`,
  `MAILGUN_DOMAIN=${staging.MAILGUN_DOMAIN || ""}`,
  `MAILGUN_REGION=${staging.MAILGUN_REGION || ""}`,
  `SMTP_HOST=${staging.SMTP_HOST || ""}`,
  `SMTP_PORT=${staging.SMTP_PORT || ""}`,
  `SMTP_SECURE=${staging.SMTP_SECURE || ""}`,
  `SMTP_USER=${staging.SMTP_USER || ""}`,
  `SMTP_PASS=${serializeValue(staging.SMTP_PASS)}`,
  `MAIL_FROM=${serializeValue(staging.MAIL_FROM)}`,
  `MAIL_REPLY_TO=${serializeValue(staging.MAIL_REPLY_TO)}`,
  `APP_PUBLIC_URL=${staging.APP_PUBLIC_URL}`
];

fs.writeFileSync(stagingPath, `${lines.join("\n")}\n`, "utf8");
console.log(
  `sync-staging-env: wrote .env.staging (APP_PUBLIC_URL=http://localhost:8080, R2_BUCKET=${staging.R2_BUCKET})`
);
