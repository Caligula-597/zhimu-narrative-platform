#!/usr/bin/env node
/** Verify production readiness and the OPS production-trust gates. */
import { loadExpectedCreatorManifest, probeCreatorFrontendSync } from "./production-frontend-sync.mjs";

const base = (process.env.CHECK_BASE_URL || process.env.APP_PUBLIC_URL || "http://127.0.0.1:4180").replace(
  /\/$/,
  ""
);
const opsToken = process.env.OPS_API_TOKEN?.trim();
const requireTrust = process.env.REQUIRE_PRODUCTION_TRUST !== "false";

const LABELS = {
  oauthGoogle: "Google OAuth",
  oauthGithub: "GitHub OAuth",
  email: "Email provider",
  r2: "R2 storage",
  livekit: "LiveKit voice",
  stripe: "Stripe",
  officialExample: "Official example env",
  deepseek: "DeepSeek AI"
};

function icon(ok) {
  return ok ? "OK" : "FAIL";
}

async function getJson(url, init = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), ...init });
  const text = await res.text();
  let body = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { res, body, text };
}

async function main() {
  const readyUrl = `${base}/api/health/ready`;
  let ready;
  try {
    ready = await getJson(readyUrl);
  } catch (error) {
    console.error(`Cannot request ${readyUrl}: ${error.message}`);
    process.exit(1);
  }
  const { res, body } = ready;
  console.log(`GET ${readyUrl} -> ${res.status}`);
  console.log(`ready: ${body.ready ?? body.ok ?? false}`);
  if (body.database?.migrationsApplied != null) {
    console.log(`migrationsApplied: ${body.database.migrationsApplied}`);
  }
  const opt = body.optionalServices;
  if (opt && typeof opt === "object") {
    console.log("\noptionalServices:");
    for (const [key, ok] of Object.entries(opt)) {
      console.log(`  ${icon(ok)} ${LABELS[key] || key}`);
    }
  }
  if (!res.ok || body.ready === false) {
    console.error("\nProduction readiness failed.");
    process.exit(1);
  }

  try {
    const expectedManifest = loadExpectedCreatorManifest({
      required: process.env.REQUIRE_CREATOR_FRONTEND_SYNC === "true"
    });
    const frontend = await probeCreatorFrontendSync(base, { expectedManifest });
    console.log(`\nCreator frontend: ${frontend.manifest.entryScript}`);
    for (const asset of frontend.verifiedDynamicAssets) {
      console.log(`  OK ${asset}`);
    }
  } catch (error) {
    console.error(`\nCreator frontend sync failed: ${error.message}`);
    process.exit(1);
  }

  if (requireTrust) {
    if (!opsToken) {
      console.error("\nOPS_API_TOKEN is required to verify productionTrust gates.");
      process.exit(1);
    }
    const opsUrl = `${base}/api/ops/status`;
    const ops = await getJson(opsUrl, { headers: { "x-ops-token": opsToken } });
    console.log(`\nGET ${opsUrl} -> ${ops.res.status}`);
    if (!ops.res.ok) {
      console.error(ops.text.slice(0, 300));
      process.exit(1);
    }
    const trust = ops.body.productionTrust;
    if (!trust?.gates?.length) {
      console.error("productionTrust payload missing.");
      process.exit(1);
    }
    console.log(`productionTrust: ${trust.passed}/${trust.total}`);
    for (const gate of trust.gates) {
      console.log(`  ${icon(gate.ok)} ${gate.key}: ${gate.detail}`);
    }
    if (!trust.ready) {
      console.error("\nProduction trust gates failed.");
      process.exit(1);
    }
  }

  console.log("\nProduction readiness passed.");
}

main();
