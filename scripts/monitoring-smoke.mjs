#!/usr/bin/env node
/**
 * Probe production/staging monitoring endpoints.
 *
 * Usage:
 *   npm run monitoring:smoke
 *   npm run monitoring:smoke -- --url http://localhost:4180
 *   npm run monitoring:smoke -- --alerts   # also POST /api/ops/alerts/test
 */
const args = process.argv.slice(2);
const baseUrl = (
  args.includes("--url")
    ? args[args.indexOf("--url") + 1]
    : process.env.APP_PUBLIC_URL || "https://app.getzhimu.com"
).replace(/\/$/, "");
const testAlerts = args.includes("--alerts");
const metricsToken = process.env.METRICS_TOKEN?.trim();
const opsToken = process.env.OPS_API_TOKEN?.trim();

function pass(label, detail = "") {
  console.log(`✔ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail = "") {
  console.error(`✘ ${label}${detail ? ` — ${detail}` : ""}`);
  process.exitCode = 1;
}

async function fetchJson(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { response, text, json };
}

console.log(`织幕 monitoring smoke → ${baseUrl}\n`);

try {
  const live = await fetchJson("/api/health/live");
  if (live.response.ok) pass("health/live", String(live.response.status));
  else fail("health/live", String(live.response.status));

  const ready = await fetchJson("/api/health/ready");
  if (ready.response.ok && ready.json?.ready === true) {
    pass("health/ready", `migrations=${ready.json?.database?.migrationsApplied ?? "?"}`);
  } else {
    fail("health/ready", ready.text.slice(0, 120));
  }

  const metricsHeaders = metricsToken ? { "X-Metrics-Token": metricsToken } : {};
  const metrics = await fetch(`${baseUrl}/metrics`, { headers: metricsHeaders });
  const metricsText = await metrics.text();
  if (metrics.ok && metricsText.includes("http_requests_total")) {
    pass("/metrics", metricsText.includes("api_ready") ? "api_ready present" : "basic metrics");
  } else if (metrics.status === 401) {
    fail("/metrics", "401 — set METRICS_TOKEN for scrape");
  } else {
    fail("/metrics", String(metrics.status));
  }

  if (testAlerts) {
    if (!opsToken) {
      fail("ops/alerts/test", "missing OPS_API_TOKEN env");
    } else {
      const alert = await fetchJson("/api/ops/alerts/test", {
        method: "POST",
        headers: { "x-ops-token": opsToken }
      });
      if (alert.response.ok && alert.json?.ok) pass("ops/alerts/test", "webhook dispatched");
      else if (alert.json?.code === "UNAVAILABLE") {
        fail("ops/alerts/test", "ALERT_WEBHOOK_URL not configured on server");
      } else {
        fail("ops/alerts/test", alert.text.slice(0, 160));
      }
    }
  } else {
    console.log("\n(skip alert webhook — run with --alerts and OPS_API_TOKEN to test)");
  }

  console.log("\nDone.");
} catch (error) {
  fail("fetch", error.message);
}
