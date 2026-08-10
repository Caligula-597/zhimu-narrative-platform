#!/usr/bin/env node
/** Post-deploy smoke: public auth config must not expose oauthDiagnostics (Trusted Beta). */
import { loadExpectedCreatorManifest, probeCreatorFrontendSync } from "./production-frontend-sync.mjs";

const base = (process.env.RAILWAY_PUBLIC_URL || process.env.APP_PUBLIC_URL || "https://app.getzhimu.com").replace(
  /\/$/,
  ""
);

async function main() {
  const url = `${base}/api/auth/config`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    console.error(`✗ Cannot reach ${url}: ${error.message}`);
    process.exit(1);
  }

  const body = await res.json().catch(() => ({}));
  console.log(`GET ${url} → ${res.status}`);

  if (!res.ok) {
    console.error("✗ auth/config not OK");
    process.exit(1);
  }

  if (body.oauthDiagnostics !== undefined) {
    console.error("✗ Production still exposes oauthDiagnostics — deploy is stale");
    console.error("  Fix: update RAILWAY_ACCOUNT_TOKEN secret and re-run Deploy to Railway");
    process.exit(1);
  }

  if (!Array.isArray(body.oauth)) {
    console.warn("⚠ oauth provider list missing (non-fatal)");
  }

  try {
    const expectedManifest = loadExpectedCreatorManifest({
      required: process.env.REQUIRE_CREATOR_FRONTEND_SYNC === "true"
    });
    const frontend = await probeCreatorFrontendSync(base, { expectedManifest });
    console.log(`Creator frontend verified: ${frontend.manifest.entryScript}`);
  } catch (error) {
    console.error(`Creator frontend sync failed: ${error.message}`);
    process.exit(1);
  }

  console.log("✓ Production release check passed (no oauthDiagnostics on /api/auth/config)");
}

main();
