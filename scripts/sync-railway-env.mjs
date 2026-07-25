/**
 * Build Railway-ready env from backend/.env + production overrides.
 * Output: .env.railway (gitignored) — import in Railway dashboard or CLI.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendEnvPath = path.join(root, "backend", ".env");
const outPath = path.join(root, ".env.railway");

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

function normalizeDatabaseUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url.replace(/^postgresql:\/\//, "http://"));
    parsed.searchParams.delete("sslmode");
    const query = parsed.searchParams.toString();
    const base = url.split("?")[0];
    return query ? `${base}?${query}` : base;
  } catch {
    return url
      .replace(/([?&])sslmode=[^&]*&?/g, (_, sep) => (sep === "?" ? "?" : ""))
      .replace(/\?&/, "?")
      .replace(/[?&]$/, "");
  }
}

/** Railway Raw Editor: avoid JSON-style quotes; use plain KEY=value or double-quoted .env */
function serializeEnv(entries) {
  return `${entries
    .map(([k, v]) => {
      const s = String(v);
      if (/[\s#]/.test(s)) return `${k}="${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
      return `${k}=${s}`;
    })
    .join("\n")}\n`;
}

const urlArg = process.argv.find((a) => a.startsWith("--url="))?.slice(6)
  ?? (process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : null);

const appUrl = (urlArg || process.env.RAILWAY_APP_PUBLIC_URL || "https://app.getzhimu.com").replace(/\/$/, "");
const marketingOrigins = (process.env.MARKETING_SITE_ORIGIN || "https://getzhimu.com,https://www.getzhimu.com")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const marketingUrl = (process.env.MARKETING_SITE_URL || marketingOrigins[0] || "https://getzhimu.com").replace(/\/$/, "");
const playOrigins = (process.env.PLAY_SITE_ORIGIN || "https://play.getzhimu.com")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const playUrl = (process.env.PLAY_SITE_URL || playOrigins[0] || "https://play.getzhimu.com").replace(/\/$/, "");
const hostOrigins = (process.env.HOST_SITE_ORIGIN || "https://host.getzhimu.com")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const hostUrl = (process.env.HOST_SITE_URL || hostOrigins[0] || "https://host.getzhimu.com").replace(/\/$/, "");

if (!fs.existsSync(backendEnvPath)) {
  console.error("sync-railway-env: backend/.env not found");
  process.exit(1);
}

const local = parseEnv(fs.readFileSync(backendEnvPath, "utf8"));
const publicUrl = appUrl;

const SECRET_KEYS = [
  "DATABASE_URL",
  "OBJECT_STORAGE_PROVIDER",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_ENDPOINT",
  "SIGNED_UPLOAD_TTL_SECONDS",
  "SIGNED_DOWNLOAD_TTL_SECONDS",
  "RECYCLE_BIN_DAYS",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL",
  "DEEPSEEK_TIMEOUT_MS",
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "RESEND_API_KEY",
  "EMAIL_PROVIDER",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "OAUTH_CALLBACK_ORIGIN",
  "CATALOG_REVIEW_NOTIFY_EMAIL",
  "METRICS_TOKEN",
  "CSP_REPORT_URI",
  "CSP_CONNECT_SRC",
  "UPLOAD_SCAN_WEBHOOK_URL",
  "UPLOAD_SCAN_WEBHOOK_SECRET",
  "UPLOAD_SCAN_CLAMAV_HOST",
  "UPLOAD_SCAN_CLAMAV_PORT",
  "UPLOAD_SCAN_TIMEOUT_MS",
  "UPLOAD_SCAN_CLAMAV_MAX_BYTES",
  "ALERT_WEBHOOK_URL",
  "ALERT_WEBHOOK_SECRET",
  "ALERT_WEBHOOK_TIMEOUT_MS",
  "ALERT_CHECK_INTERVAL_MS",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_SERVICE_NAME",
  "OTEL_EXPORTER_OTLP_HEADERS"
];

const env = {};
for (const key of SECRET_KEYS) {
  if (local[key]) env[key] = local[key];
}

// Resend: plain "Name <email>" — no nested JSON quotes (Railway misparses those)
const mailFrom = (local.MAIL_FROM || "").replace(/^["']|["']$/g, "").trim();
env.MAIL_FROM = mailFrom.includes("@") ? mailFrom : "织幕 <noreply@mail.getzhimu.com>";
env.SUPPORT_EMAIL = local.SUPPORT_EMAIL?.trim() || "support@getzhimu.com";
env.HELLO_EMAIL = local.HELLO_EMAIL?.trim() || "hello@getzhimu.com";
env.ADMIN_EMAIL = local.ADMIN_EMAIL?.trim() || "admin@getzhimu.com";
env.MAIL_REPLY_TO = local.MAIL_REPLY_TO?.trim() || env.SUPPORT_EMAIL;
env.BETA_REVIEW_NOTIFY_EMAIL = local.BETA_REVIEW_NOTIFY_EMAIL?.trim() || env.ADMIN_EMAIL;
env.CATALOG_REVIEW_NOTIFY_EMAIL = local.CATALOG_REVIEW_NOTIFY_EMAIL?.trim() || env.ADMIN_EMAIL;
env.PLAN_UPGRADE_NOTIFY_EMAIL = local.PLAN_UPGRADE_NOTIFY_EMAIL?.trim() || env.ADMIN_EMAIL;
env.ALERT_EMAIL = local.ALERT_EMAIL?.trim() || env.ADMIN_EMAIL;

env.NODE_ENV = "production";
env.ALLOW_DEMO_USER_HEADER = "false";
env.DATABASE_URL = normalizeDatabaseUrl(local.DATABASE_URL);
env.DATABASE_SSL = "true";
// Session pooler capacity is 15 on the current plan. Keep a two-instance
// rolling deploy (6 + 6) below that ceiling and reserve three ops slots.
env.PGPOOL_MAX = local.PGPOOL_MAX?.trim() || "6";
env.PGPOOL_IDLE_MS = local.PGPOOL_IDLE_MS?.trim() || "30000";
env.PGPOOL_CONNECTION_TIMEOUT_MS = local.PGPOOL_CONNECTION_TIMEOUT_MS?.trim() || "10000";
env.PGPOOL_MAX_LIFETIME_SECONDS = local.PGPOOL_MAX_LIFETIME_SECONDS?.trim() || "1800";
env.PG_STATEMENT_TIMEOUT_MS = local.PG_STATEMENT_TIMEOUT_MS?.trim() || "30000";
env.PG_IDLE_IN_TRANSACTION_TIMEOUT_MS =
  local.PG_IDLE_IN_TRANSACTION_TIMEOUT_MS?.trim() || "15000";
env.TRUST_PROXY_HOPS = local.TRUST_PROXY_HOPS?.trim() || "1";
env.APP_INSTANCE_COUNT = local.APP_INSTANCE_COUNT?.trim() || "1";
env.EDGE_RATE_LIMIT_VERIFIED = local.EDGE_RATE_LIMIT_VERIFIED?.trim() || "false";
env.TRUSTED_TYPES_ENFORCE = local.TRUSTED_TYPES_ENFORCE?.trim() || "true";
if (local.LLM_CREDENTIALS_SECRET?.trim()) {
  env.LLM_CREDENTIALS_SECRET = local.LLM_CREDENTIALS_SECRET.trim();
}
env.HTTP_REQUEST_TIMEOUT_MS = local.HTTP_REQUEST_TIMEOUT_MS?.trim() || "120000";
env.SESSION_LAST_SEEN_TOUCH_SECONDS = local.SESSION_LAST_SEEN_TOUCH_SECONDS?.trim() || "300";
env.SSE_MAX_BUFFERED_BYTES = local.SSE_MAX_BUFFERED_BYTES?.trim() || "1048576";
env.APP_PUBLIC_URL = publicUrl;
// Keep the standalone host portal compatible with the currently deployed API,
// including releases that predate HOST_SITE_ORIGIN-aware CORS resolution.
env.CORS_ORIGIN = [...new Set([publicUrl, ...hostOrigins])].join(",");
env.MARKETING_SITE_ORIGIN = marketingOrigins.join(",");
env.MARKETING_SITE_URL = marketingUrl;
env.PLAY_SITE_ORIGIN = playOrigins.join(",");
env.PLAY_SITE_URL = playUrl;
env.HOST_SITE_ORIGIN = hostOrigins.join(",");
env.HOST_SITE_URL = hostUrl;
env.EMAIL_PROVIDER = env.EMAIL_PROVIDER || "resend";
env.REQUIRE_EMAIL_VERIFICATION = "true";
env.BILLING_LAUNCH_ENABLED = "false";
env.PRICING_PAGE_MODE = "launch";
env.COMMERCIAL_PRICING_PUBLIC = "false";
env.CREDITS_SYSTEM_ENABLED = "false";
env.CREDITS_DEBIT_AI = "false";
env.CREDITS_UI_VISIBLE = "false";
env.RUN_DB_SEED = "false";
env.OFFICIAL_EXAMPLE_WORLD_ID =
  local.OFFICIAL_EXAMPLE_WORLD_ID?.trim() || "20725d66-35ec-4d2f-aef8-4794cef6ace1";
env.LOG_FORMAT = "json";
env.LOG_LEVEL = "info";
env.ROOM_EVENTS_BUS = "postgres";
env.ROOM_DEFAULT_CONTENT_BINDING =
  local.ROOM_DEFAULT_CONTENT_BINDING?.trim() || "live_draft";
env.OPENAPI_UI = "false";
env.SERVE_STATIC = "true";
env.STATIC_ROOT = "/app/public/dist";
env.CSP_MODE = "enforce";
env.UPLOAD_SCAN_MODE = "strict";
env.OTEL_ENABLED = "true";
env.OTEL_SERVICE_NAME = env.OTEL_SERVICE_NAME || "zhimu-api";
env.RATE_LIMIT_AUTH_MAX = "20";
env.RATE_LIMIT_AUTH_RECOVERY_MAX = "6";
env.RATE_LIMIT_VERIFICATION_RESEND_MAX = "3";
env.RETENTION_ACCOUNT_CREATION_EVENTS_DAYS = "7";
env.RATE_LIMIT_WRITE_MAX = "120";
env.RATE_LIMIT_READ_MAX = "300";
env.RATE_LIMIT_UPLOAD_MAX = "30";
env.RATE_LIMIT_UPLOAD_IP_MAX = "120";
env.RATE_LIMIT_DOCUMENT_MAX = "10";
env.RATE_LIMIT_DOCUMENT_IP_MAX = "60";
env.RATE_LIMIT_SCRIPT_BUNDLE_MAX = "4";
env.RATE_LIMIT_SCRIPT_BUNDLE_IP_MAX = "20";
env.RATE_LIMIT_AI_MAX = "40";
env.RATE_LIMIT_AI_IP_MAX = "160";
env.RATE_LIMIT_INVITE_LOOKUP_MAX = "30";
env.RATE_LIMIT_INVITE_LOOKUP_IP_MAX = "120";
env.RATE_LIMIT_ROOM_JOIN_MAX = "12";
env.RATE_LIMIT_ROOM_JOIN_IP_MAX = "80";
env.RATE_LIMIT_VOICE_READ_MAX = "120";
env.RATE_LIMIT_VOICE_READ_IP_MAX = "600";
env.RATE_LIMIT_VOICE_MESSAGE_MAX = "20";
env.RATE_LIMIT_VOICE_MESSAGE_IP_MAX = "240";
env.RATE_LIMIT_VOICE_TOKEN_MAX = "10";
env.RATE_LIMIT_VOICE_TOKEN_IP_MAX = "120";
env.RATE_LIMIT_VOICE_CREATE_MAX = "5";
env.RATE_LIMIT_VOICE_CREATE_IP_MAX = "60";
env.RATE_LIMIT_VOICE_INVITE_MAX = "10";
env.RATE_LIMIT_VOICE_INVITE_IP_MAX = "120";
env.LIVEKIT_TOKEN_TTL_SECONDS = local.LIVEKIT_TOKEN_TTL_SECONDS?.trim() || "600";
env.VOICE_ROOM_ACTIVE_LIMIT = local.VOICE_ROOM_ACTIVE_LIMIT?.trim() || "30";
env.VOICE_PRIVATE_ROOM_LIFETIME_HOURS = local.VOICE_PRIVATE_ROOM_LIFETIME_HOURS?.trim() || "24";
env.RETENTION_VOICE_MESSAGES_DAYS = local.RETENTION_VOICE_MESSAGES_DAYS?.trim() || "90";
env.EMAIL_REQUEST_TIMEOUT_MS = local.EMAIL_REQUEST_TIMEOUT_MS?.trim() || "15000";
env.OAUTH_REQUEST_TIMEOUT_MS = local.OAUTH_REQUEST_TIMEOUT_MS?.trim() || "15000";
env.STRIPE_REQUEST_TIMEOUT_MS = local.STRIPE_REQUEST_TIMEOUT_MS?.trim() || "15000";
env.ALERT_WEBHOOK_TIMEOUT_MS = local.ALERT_WEBHOOK_TIMEOUT_MS?.trim() || "15000";

if (local.REQUIRE_OAUTH_IN_PRODUCTION?.trim()) {
  env.REQUIRE_OAUTH_IN_PRODUCTION = local.REQUIRE_OAUTH_IN_PRODUCTION.trim();
}
if (local.CATALOG_REVIEW_NOTIFY_EMAIL?.trim()) {
  env.CATALOG_REVIEW_NOTIFY_EMAIL = local.CATALOG_REVIEW_NOTIFY_EMAIL.trim();
}

if (local.OPS_API_TOKEN?.trim()) {
  env.OPS_API_TOKEN = local.OPS_API_TOKEN.trim();
} else {
  env.OPS_API_TOKEN = crypto.randomBytes(24).toString("base64url");
}

if (!env.METRICS_TOKEN?.trim()) {
  env.METRICS_TOKEN = crypto.randomBytes(24).toString("base64url");
}

const required = [
  "DATABASE_URL",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "APP_PUBLIC_URL",
  "OPS_API_TOKEN",
  "METRICS_TOKEN",
  "ALERT_WEBHOOK_URL",
  "OTEL_EXPORTER_OTLP_ENDPOINT"
];
const missing = required.filter((k) => !env[k]?.trim());
const hasExternalScanner = Boolean(env.UPLOAD_SCAN_WEBHOOK_URL?.trim() || env.UPLOAD_SCAN_CLAMAV_HOST?.trim());
if (!hasExternalScanner) {
  missing.push("UPLOAD_SCAN_WEBHOOK_URL or UPLOAD_SCAN_CLAMAV_HOST");
}
if (missing.length) {
  console.error(`sync-railway-env: missing in backend/.env: ${missing.join(", ")}`);
  process.exit(1);
}

const header = `# Paste into Railway → zhimu-narrative-platform → Variables → Raw Editor
# Fullstack: API + 前端同一服务（deploy/Dockerfile.fullstack）
# Do NOT set PORT — Railway injects it automatically.
# GitHub Actions: railway up from repo root (railway.toml)
`;
fs.writeFileSync(outPath, header + serializeEnv(Object.entries(env)), "utf8");

console.log("sync-railway-env: wrote .env.railway");
console.log(`  APP_PUBLIC_URL=${publicUrl}`);
console.log(`  MARKETING_SITE_ORIGIN=${env.MARKETING_SITE_ORIGIN}`);
console.log(`  MARKETING_SITE_URL=${env.MARKETING_SITE_URL}`);
console.log(`  PLAY_SITE_ORIGIN=${env.PLAY_SITE_ORIGIN}`);
console.log(`  PLAY_SITE_URL=${env.PLAY_SITE_URL}`);
console.log(`  HOST_SITE_ORIGIN=${env.HOST_SITE_ORIGIN}`);
console.log(`  HOST_SITE_URL=${env.HOST_SITE_URL}`);
console.log(`  keys=${Object.keys(env).length}`);
console.log("  OFFICIAL_EXAMPLE_WORLD_ID=" + env.OFFICIAL_EXAMPLE_WORLD_ID);
console.log("  SKIP_ENSURE_PLATFORM_CATALOG removed (legacy demo deleted)");
console.log("  DATABASE_URL sslmode stripped (use DATABASE_SSL=true instead)");
