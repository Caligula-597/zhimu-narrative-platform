#!/usr/bin/env node
/** Smoke-check Cloudflare Pages domains and the shared API health endpoint. */
const args = process.argv.slice(2);
const timeoutMs = Number(process.env.PAGES_SMOKE_TIMEOUT_MS || 15_000);
const siteUrl = (process.env.SITE_PUBLIC_URL || "https://getzhimu.com").replace(/\/$/, "");
const playUrl = (process.env.PLAY_SITE_URL || "https://play.getzhimu.com").replace(/\/$/, "");
const hostUrl = (process.env.HOST_SITE_URL || "https://host.getzhimu.com").replace(/\/$/, "");
const appUrl = (process.env.APP_PUBLIC_URL || "https://app.getzhimu.com").replace(/\/$/, "");
const skipApi = args.includes("--skip-api");

const checks = [
  { label: "site", url: siteUrl, expect: ["织幕", "剧本", "zhimu"] },
  { label: "play", url: playUrl, expect: ["玩家", "邀请码", "织幕", "play"] },
  { label: "host", url: hostUrl, expect: ["主持", "监控", "织幕", "host"] }
];
if (!skipApi) {
  checks.push({ label: "api/ready", url: `${appUrl}/api/health/ready`, json: true });
}

function pass(label, detail) {
  console.log(`OK ${label}${detail ? ` - ${detail}` : ""}`);
}

function fail(label, detail) {
  console.error(`FAIL ${label}${detail ? ` - ${detail}` : ""}`);
  process.exitCode = 1;
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs)
  });
  const text = await response.text();
  return { response, text };
}

for (const check of checks) {
  try {
    const { response, text } = await fetchText(check.url);
    if (!response.ok) {
      fail(check.label, `${response.status} ${check.url}`);
      continue;
    }
    if (check.json) {
      const body = JSON.parse(text);
      if (body.ok === false || body.ready === false) fail(check.label, text.slice(0, 160));
      else pass(check.label, `${response.status} ${check.url}`);
      continue;
    }
    const csp = response.headers.get("content-security-policy") || "";
    const hsts = response.headers.get("strict-transport-security") || "";
    const frameProtection = response.headers.get("x-frame-options") || csp;
    if (!csp.includes("require-trusted-types-for 'script'")
      || !csp.includes("frame-ancestors 'none'")
      || !/max-age=/i.test(hsts)
      || !/(DENY|frame-ancestors 'none')/i.test(frameProtection)) {
      fail(check.label, `security headers incomplete at ${check.url}`);
      continue;
    }
    const lower = text.toLowerCase();
    const matched = check.expect.some((word) => lower.includes(word.toLowerCase()));
    if (!matched) {
      fail(check.label, `content marker missing at ${check.url}`);
      continue;
    }
    pass(check.label, `${response.status} ${check.url}`);
  } catch (error) {
    fail(check.label, error.message);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log("Pages smoke passed.");
