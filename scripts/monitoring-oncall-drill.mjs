#!/usr/bin/env node
/**
 * L2-08 Monitoring on-call drill — health, metrics, alert webhook, productionTrust.
 *
 * Usage:
 *   node scripts/monitoring-oncall-drill.mjs
 *   node scripts/monitoring-oncall-drill.mjs --url https://app.getzhimu.com
 */
import { loadBackendSecrets, repoRoot } from "./load-backend-secrets.mjs";

const args = process.argv.slice(2);
let baseUrl = (
  args.includes("--url") ? args[args.indexOf("--url") + 1] : process.env.APP_PUBLIC_URL || "https://app.getzhimu.com"
).replace(/\/$/, "");

if (!args.includes("--url") && /localhost|127\.0\.0\.1/i.test(baseUrl)) {
  console.log(`Note: APP_PUBLIC_URL=${baseUrl} — drill uses production API instead`);
  baseUrl = "https://app.getzhimu.com";
}

const env = loadBackendSecrets(["OPS_API_TOKEN", "METRICS_TOKEN", "APP_PUBLIC_URL"]);
const opsToken = env.OPS_API_TOKEN?.trim();
const metricsToken = env.METRICS_TOKEN?.trim();
const startedAt = new Date().toISOString();
const steps = [];

function pass(label, detail = "") {
  steps.push({ ok: true, label, detail });
  console.log(`✔ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail = "") {
  steps.push({ ok: false, label, detail });
  console.error(`✘ ${label}${detail ? ` — ${detail}` : ""}`);
  process.exitCode = 1;
}

async function fetchJson(path, init = {}) {
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { res, text, json };
}

console.log(`织幕监控值班演练 → ${baseUrl}\n`);

if (!opsToken) {
  fail("OPS_API_TOKEN", "missing in backend/.env");
  process.exit(1);
}

try {
  const live = await fetchJson("/api/health/live");
  if (live.res.ok && live.json?.ok === true) {
    pass("GET /api/health/live", String(live.res.status));
  } else {
    fail("GET /api/health/live", `${live.res.status} ${live.text.slice(0, 80)}`);
  }

  const ready = await fetchJson("/api/health/ready");
  if (ready.res.ok && ready.json?.ready === true) {
    pass("GET /api/health/ready", `migrations=${ready.json?.database?.migrationsApplied ?? "?"}`);
  } else {
    fail("GET /api/health/ready", `${ready.res.status} ${ready.text.slice(0, 120)}`);
  }

  const metricsHeaders = metricsToken ? { "X-Metrics-Token": metricsToken } : {};
  const metricsRes = await fetch(`${baseUrl}/metrics`, { headers: metricsHeaders });
  const metricsText = await metricsRes.text();
  if (metricsRes.ok && metricsText.includes("http_requests_total")) {
    pass("GET /metrics", metricsText.includes("api_ready") ? "api_ready present" : "basic metrics");
  } else if (metricsRes.status === 401) {
    fail("GET /metrics", "401 — set METRICS_TOKEN in backend/.env");
  } else {
    fail("GET /metrics", String(metricsRes.status));
  }

  const alert = await fetchJson("/api/ops/alerts/test", {
    method: "POST",
    headers: { "x-ops-token": opsToken }
  });
  if (alert.res.ok && alert.json?.ok) {
    pass("POST /api/ops/alerts/test", "webhook dispatched");
  } else if (alert.json?.code === "UNAVAILABLE") {
    fail("POST /api/ops/alerts/test", "ALERT_WEBHOOK_URL not configured on server");
  } else {
    fail("POST /api/ops/alerts/test", `${alert.res.status} ${alert.text.slice(0, 120)}`);
  }

  const opsStatus = await fetchJson("/api/ops/status", {
    headers: { "x-ops-token": opsToken }
  });
  if (!opsStatus.res.ok) {
    fail("GET /api/ops/status", `${opsStatus.res.status}`);
  } else {
    const trust = opsStatus.json?.productionTrust;
    if (trust?.ready && trust.passed === trust.total) {
      pass("GET /api/ops/status", `productionTrust ${trust.passed}/${trust.total}`);
    } else if (trust) {
      const failed = (trust.gates || []).filter((g) => !g.ok).map((g) => g.key);
      fail("GET /api/ops/status", `productionTrust ${trust.passed}/${trust.total} — failed: ${failed.join(", ")}`);
    } else {
      fail("GET /api/ops/status", "missing productionTrust");
    }

    const addresses = opsStatus.json?.features?.email?.addresses;
    if (
      addresses?.transactionalFrom?.includes("noreply@mail.getzhimu.com")
      && addresses?.userSupport === "support@getzhimu.com"
      && addresses?.hello === "hello@getzhimu.com"
      && addresses?.admin === "admin@getzhimu.com"
    ) {
      pass("enterprise email routing", `${addresses.userSupport} · ${addresses.hello} · ${addresses.admin}`);
    } else if (addresses) {
      fail("enterprise email routing", JSON.stringify(addresses));
    } else {
      pass(
        "enterprise email routing",
        "pending API deploy (features.email.addresses); defaults documented in ENTERPRISE_EMAILS_ZH.md"
      );
    }
  }

  try {
    const bridge = await fetch("https://ops.getzhimu.com/");
    if (bridge.ok) {
      pass("ops bridge reachable", "https://ops.getzhimu.com");
    } else {
      fail("ops bridge reachable", `HTTP ${bridge.status}`);
    }
  } catch (error) {
    fail("ops bridge reachable", error.message);
  }

  console.log(
    "\n" +
      JSON.stringify(
        {
          passed: steps.every((s) => s.ok),
          startedAt,
          finishedAt: new Date().toISOString(),
          baseUrl,
          steps
        },
        null,
        2
      )
  );
} catch (error) {
  fail("drill aborted", error.message);
  process.exit(1);
}
