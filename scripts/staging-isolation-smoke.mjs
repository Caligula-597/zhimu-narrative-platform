#!/usr/bin/env node
/**
 * L1-07 Staging isolation smoke — verify staging config is separated from production,
 * then optionally run functional `staging-smoke.mjs` when the stack is up.
 *
 * Usage:
 *   node scripts/staging-isolation-smoke.mjs
 *   node scripts/staging-isolation-smoke.mjs --config-only
 *   node scripts/staging-isolation-smoke.mjs --skip-functional
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const configOnly = args.includes("--config-only");
const skipFunctional = args.includes("--skip-functional") || configOnly;

const backendEnvPath = path.join(root, "backend", ".env");
const stagingEnvPath = path.join(root, ".env.staging");
const composePath = path.join(root, "docker-compose.staging.yml");

const PROD_APP_URL = (process.env.PRODUCTION_APP_URL || "https://app.getzhimu.com").replace(/\/$/, "");

const checks = [];

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

function dbHost(databaseUrl) {
  if (!databaseUrl) return "";
  try {
    const normalized = databaseUrl.replace(/^postgresql:\/\//, "http://");
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function pass(name, detail = "") {
  checks.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail = "") {
  checks.push({ name, ok: false, detail });
  console.error(`FAIL  ${name}${detail ? `: ${detail}` : ""}`);
  process.exitCode = 1;
}

function warn(name, detail = "") {
  checks.push({ name, ok: true, detail: `SKIP — ${detail}`, skipped: true });
  console.warn(`SKIP  ${name}: ${detail}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not json */
  }
  return { response, json, text };
}

console.log("织幕 L1-07 Staging 隔离 smoke\n");

if (!fs.existsSync(stagingEnvPath)) {
  fail("staging env file", "missing .env.staging — run npm run staging:sync-env");
  summarize();
  process.exit(1);
}

const backend = fs.existsSync(backendEnvPath) ? parseEnv(fs.readFileSync(backendEnvPath, "utf8")) : {};
const staging = parseEnv(fs.readFileSync(stagingEnvPath, "utf8"));
const composeText = fs.readFileSync(composePath, "utf8");

const prodDbHost = dbHost(backend.DATABASE_URL);
const stagingBase = (staging.STAGING_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const stagingAppUrl = (staging.APP_PUBLIC_URL || stagingBase).replace(/\/$/, "");
const prodBucket = (backend.R2_BUCKET || "").trim();
const stagingBucket = (staging.R2_BUCKET || "").trim();

if (prodDbHost) {
  const localDbHosts = new Set(["localhost", "127.0.0.1", "postgres"]);
  if (localDbHosts.has(prodDbHost)) {
    fail("production DATABASE host", `backend/.env points to local host ${prodDbHost}`);
  } else {
    pass("production DATABASE host", prodDbHost);
  }
} else {
  warn("production DATABASE host", "backend/.env DATABASE_URL not set — skipping prod DB reference");
}

if (/DATABASE_URL:\s*postgresql:\/\/zhimu:\$\{POSTGRES_PASSWORD\}@postgres:5432\/zhimu/.test(composeText)) {
  pass("compose DATABASE_URL", "local postgres service (postgres:5432/zhimu)");
} else {
  fail("compose DATABASE_URL", "expected local postgres service in docker-compose.staging.yml");
}

if (staging.DATABASE_URL) {
  const stagingHost = dbHost(staging.DATABASE_URL);
  if (stagingHost && stagingHost === prodDbHost) {
    fail("staging DATABASE_URL in .env.staging", `must not reuse production host ${prodDbHost}`);
  }
  if (stagingHost && !["postgres", "localhost", "127.0.0.1"].includes(stagingHost)) {
    fail("staging DATABASE_URL in .env.staging", `unexpected external host ${stagingHost}`);
  }
}

if (prodBucket && stagingBucket) {
  if (stagingBucket === prodBucket) {
    fail("R2 bucket isolation", `staging R2_BUCKET=${stagingBucket} matches production — run npm run staging:sync-env`);
  } else {
    pass("R2 bucket isolation", `prod=${prodBucket} staging=${stagingBucket}`);
  }
} else if (!stagingBucket) {
  fail("R2 bucket isolation", "R2_BUCKET missing in .env.staging");
} else {
  pass("R2 bucket isolation", `staging=${stagingBucket} (no prod bucket to compare)`);
}

if (/app\.getzhimu\.com/i.test(stagingAppUrl)) {
  fail("APP_PUBLIC_URL", `staging must not use production domain (${stagingAppUrl})`);
} else if (/localhost|127\.0\.0\.1|staging\./i.test(stagingAppUrl)) {
  pass("APP_PUBLIC_URL", stagingAppUrl);
} else {
  fail("APP_PUBLIC_URL", `unexpected staging URL ${stagingAppUrl}`);
}

const cors = (staging.CORS_ORIGIN || "").trim();
if (/app\.getzhimu\.com/i.test(cors)) {
  fail("CORS_ORIGIN", "must not allow production app origin");
} else if (cors === stagingBase || /localhost|127\.0\.0\.1|staging\./i.test(cors)) {
  pass("CORS_ORIGIN", cors || stagingBase);
} else {
  fail("CORS_ORIGIN", `expected ${stagingBase}, got ${cors || "(empty)"}`);
}

if (/ALLOW_DEMO_USER_HEADER:\s*"false"/.test(composeText)) {
  pass("ALLOW_DEMO_USER_HEADER", "false in compose");
} else {
  fail("ALLOW_DEMO_USER_HEADER", 'expected "false" in docker-compose.staging.yml');
}

if (staging.VITE_DEMO_MODE === "false" && staging.VITE_REQUIRE_AUTH === "true") {
  pass("frontend auth flags", "VITE_REQUIRE_AUTH=true, VITE_DEMO_MODE=false");
} else {
  fail("frontend auth flags", `VITE_REQUIRE_AUTH=${staging.VITE_REQUIRE_AUTH} VITE_DEMO_MODE=${staging.VITE_DEMO_MODE}`);
}

if (staging.POSTGRES_PASSWORD?.trim()) {
  pass("local Postgres password", "set in .env.staging");
} else {
  fail("local Postgres password", "POSTGRES_PASSWORD missing");
}

if (!skipFunctional) {
  console.log("\n--- functional staging smoke ---\n");
  let stagingLive = false;
  try {
    const live = await fetchJson(`${stagingBase}/api/health/live`);
    stagingLive = live.response.ok && live.json?.ok === true;
  } catch (error) {
    stagingLive = false;
  }

  if (!stagingLive) {
    warn("staging stack reachable", `start Docker then npm run staging:up (${stagingBase})`);
  } else {
    pass("staging stack reachable", stagingBase);

    try {
      const prodLive = await fetchJson(`${PROD_APP_URL}/api/health/live`);
      if (prodLive.response.ok) {
        pass("production reference reachable", PROD_APP_URL);
      }
    } catch {
      warn("production reference reachable", `${PROD_APP_URL} unreachable — isolation config still validated`);
    }

    const result = spawnSync(process.execPath, ["scripts/staging-smoke.mjs"], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, STAGING_BASE_URL: stagingBase },
      shell: process.platform === "win32"
    });
    if (result.status !== 0) {
      fail("staging-smoke.mjs", `exit ${result.status ?? 1}`);
    } else {
      pass("staging-smoke.mjs", "all checks passed");
    }
  }
}

summarize();
process.exit(process.exitCode || 0);

function summarize() {
  const failed = checks.filter((c) => !c.ok);
  const skipped = checks.filter((c) => c.skipped);
  const passed = checks.filter((c) => c.ok && !c.skipped);
  console.log(`\nStaging isolation smoke: ${passed.length}/${checks.length} passed` +
    (skipped.length ? ` (${skipped.length} skipped)` : "") +
    (failed.length ? ` — ${failed.length} failed` : ""));
}
