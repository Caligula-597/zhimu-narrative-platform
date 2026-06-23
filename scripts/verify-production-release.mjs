#!/usr/bin/env node
/** Post-deploy smoke: public auth config must not expose oauthDiagnostics (Trusted Beta). */
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

  console.log("✓ Production release check passed (no oauthDiagnostics on /api/auth/config)");
}

main();
