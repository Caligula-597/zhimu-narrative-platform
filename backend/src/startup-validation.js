/**
 * Startup validation — fail fast before listen() with actionable errors.
 * Catches: missing env, broken module graph, incomplete DB schema.
 */
import { getDatabaseStatus } from "./database-status.js";
import { isEmailConfigured } from "./email.js";
import { validateOAuthProductionConfig } from "./oauth-diagnostics.js";

const REQUIRED_ENV = ["DATABASE_URL"];

export function validateStartupEnvironment() {
  const missing = REQUIRED_ENV.filter((key) => !String(process.env[key] ?? "").trim());
  if (missing.length) {
    console.error("FATAL: Missing required environment variables:");
    for (const key of missing) console.error(`  - ${key}`);
    console.error("Copy backend/.env.example to backend/.env and configure PostgreSQL.");
    process.exit(1);
  }

  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv === "production" && process.env.ALLOW_DEMO_USER_HEADER === "true") {
    console.error("FATAL: ALLOW_DEMO_USER_HEADER=true is forbidden when NODE_ENV=production.");
    console.error("Remove ALLOW_DEMO_USER_HEADER or set it to false before deploying.");
    process.exit(1);
  }

  const port = Number(process.env.PORT ?? 4180);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`FATAL: Invalid PORT "${process.env.PORT}"`);
    process.exit(1);
  }

  if (nodeEnv === "production") {
    if (process.env.REQUIRE_EMAIL_VERIFICATION === "true" && !isEmailConfigured()) {
      console.error("FATAL: REQUIRE_EMAIL_VERIFICATION=true but email provider is not configured.");
      console.error("Set EMAIL_PROVIDER + MAIL_FROM + provider API keys, or disable REQUIRE_EMAIL_VERIFICATION.");
      process.exit(1);
    }
    if (!process.env.APP_PUBLIC_URL?.trim()) {
      console.warn("WARN: APP_PUBLIC_URL is empty — password reset and email verification links will fail.");
    }
    if (!process.env.OPS_API_TOKEN?.trim()) {
      console.warn("WARN: OPS_API_TOKEN is empty — /api/ops/* endpoints reject all requests in production.");
    }
    if (!process.env.LLM_CREDENTIALS_SECRET?.trim() && !process.env.OPS_API_TOKEN?.trim()) {
      console.warn("WARN: LLM_CREDENTIALS_SECRET is empty — users cannot save BYOK API keys until configured.");
    }
    if (!process.env.METRICS_TOKEN?.trim()) {
      console.warn("WARN: METRICS_TOKEN is empty — /metrics endpoint rejects all requests in production.");
    }

    const oauth = validateOAuthProductionConfig();
    for (const warning of oauth.warnings) console.warn(`WARN: ${warning}`);
    for (const fatal of oauth.fatals) console.error(`FATAL: ${fatal}`);
    if (oauth.fatals.length) process.exit(1);
  }
}

/** Resolve entire Fastify module graph (import paths, route registration). */
export async function validateApplicationGraph() {
  try {
    const { createApp } = await import("./app.js");
    const app = await createApp({ logger: false, allowDemoUserHeader: true });
    await app.inject({ method: "GET", url: "/api/health/live" });
    await app.close();
  } catch (error) {
    console.error("FATAL: Application module graph failed to load.");
    console.error(error?.stack || error?.message || error);
    console.error("Run: cd backend && npm run check:modules");
    process.exit(1);
  }
}

export async function validateDatabaseSchema({ strict = true } = {}) {
  try {
    const status = await getDatabaseStatus();
    if (status.missingTables?.length) {
      const message = `Database schema incomplete. Missing tables: ${status.missingTables.join(", ")}`;
      if (strict) {
        console.error(`FATAL: ${message}`);
        console.error("Run: cd backend && npm run db:migrate");
        process.exit(1);
      }
      console.warn(`WARN: ${message}`);
      return status;
    }
    return status;
  } catch (error) {
    console.error("FATAL: Cannot reach PostgreSQL. Check DATABASE_URL and that Postgres is running.");
    console.error(error?.message || error);
    process.exit(1);
  }
}

export async function runStartupValidation() {
  validateStartupEnvironment();
  await validateApplicationGraph();
  await validateDatabaseSchema({ strict: true });
}
