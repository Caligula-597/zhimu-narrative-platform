#!/usr/bin/env node
/**
 * Guardian periodic poll — health, metrics, product probes, optional pg_stat + web-vitals.
 *
 * Usage:
 *   npm run guardian:poll
 *   npm run guardian:poll -- --url https://app.getzhimu.com
 *   npm run guardian:poll -- --product-probes --pg-stat
 *   npm run guardian:poll -- --json
 *
 * Env:
 *   APP_PUBLIC_URL, METRICS_TOKEN, OPS_API_TOKEN, DATABASE_URL
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runGuardianProductProbes } from "./guardian-product-probes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function argValue(flag, fallback = "") {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : fallback;
}

const baseUrl = (argValue("--url") || process.env.APP_PUBLIC_URL || "http://localhost:4180").replace(/\/$/, "");
const jsonOut = args.includes("--json");
const productProbes = args.includes("--product-probes") || !args.includes("--skip-product-probes");
const pgStat = args.includes("--pg-stat");
const webVitals = args.includes("--web-vitals") || productProbes;
const testAlerts = args.includes("--alerts");
const metricsToken = process.env.METRICS_TOKEN?.trim();
const opsToken = process.env.OPS_API_TOKEN?.trim();

/** @type {{ name: string, ok: boolean, detail?: string }[]} */
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!jsonOut) {
    console.log(`${ok ? "✔" : "✘"} ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function fetchJson(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { response, text, json };
}

async function runHealthChecks() {
  const live = await fetchJson("/api/health/live");
  record("health/live", live.response.ok, String(live.response.status));

  const ready = await fetchJson("/api/health/ready");
  const readyOk = ready.response.ok && ready.json?.ready === true;
  record(
    "health/ready",
    readyOk,
    readyOk ? `migrations=${ready.json?.database?.migrationsApplied ?? "?"}` : ready.text.slice(0, 120)
  );
}

async function runMetricsCheck() {
  const headers = metricsToken ? { "X-Metrics-Token": metricsToken } : {};
  const response = await fetch(`${baseUrl}/metrics`, { headers });
  const text = await response.text();
  if (response.ok && text.includes("http_requests_total")) {
    record("/metrics", true, text.includes("web_vitals_total") ? "web_vitals present" : "basic metrics");
    return;
  }
  if (response.status === 401) {
    record("/metrics", false, "401 — set METRICS_TOKEN");
    return;
  }
  record("/metrics", false, String(response.status));
}

async function runWebVitalsProbe() {
  const response = await fetch(`${baseUrl}/api/metrics/web-vitals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "LCP", value: 1200, id: `guardian-${Date.now()}`, app: "guardian" })
  });
  record("web-vitals beacon", response.status === 204, String(response.status));
}

async function runAlertProbe() {
  if (!testAlerts) return;
  if (!opsToken) {
    record("ops/alerts/test", false, "missing OPS_API_TOKEN");
    return;
  }
  const alert = await fetchJson("/api/ops/alerts/test", {
    method: "POST",
    headers: { "x-ops-token": opsToken }
  });
  if (alert.response.ok && alert.json?.ok) record("ops/alerts/test", true, "dispatched");
  else record("ops/alerts/test", false, alert.text.slice(0, 160));
}

function runPgStatReport() {
  if (!pgStat) return;
  if (!process.env.DATABASE_URL?.trim()) {
    record("pg_stat_statements report", false, "DATABASE_URL not set");
    return;
  }
  const result = spawnSync(process.execPath, ["scripts/pg-stat-report.mjs", "--limit=5"], {
    cwd: path.join(root, "backend"),
    encoding: "utf8",
    env: process.env
  });
  record("pg_stat_statements report", result.status === 0, result.status === 0 ? "top queries printed" : result.stderr?.slice(0, 120) || `exit ${result.status}`);
}

async function main() {
  if (!jsonOut) console.log(`Guardian poll → ${baseUrl}\n`);

  await runHealthChecks();
  await runMetricsCheck();
  if (webVitals) await runWebVitalsProbe();
  await runAlertProbe();

  if (productProbes) {
    const probes = await runGuardianProductProbes(baseUrl);
    for (const row of probes.checks) {
      record(`product:${row.label}`, row.ok, row.ok ? String(row.status) : row.detail);
    }
  }

  runPgStatReport();

  const failed = results.filter((row) => !row.ok);
  if (jsonOut) {
    console.log(JSON.stringify({ baseUrl, ok: failed.length === 0, results }, null, 2));
  } else if (failed.length) {
    console.error(`\nGuardian poll failed: ${failed.length}/${results.length}`);
  } else {
    console.log(`\n✓ Guardian poll passed (${results.length} checks)`);
  }

  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
