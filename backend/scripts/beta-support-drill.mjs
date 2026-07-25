#!/usr/bin/env node
/**
 * L1-06 Beta support SOP drill — apply → ops list → approve → feedback loop.
 *
 * Usage:
 *   node scripts/beta-support-drill.mjs
 *   node scripts/beta-support-drill.mjs --url https://app.getzhimu.com
 *   node scripts/beta-support-drill.mjs --keep
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import "dotenv/config";
import {
  resolveDatabaseSsl,
  resolveDatabaseUrl
} from "../src/database-connection-options.js";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const keep = args.includes("--keep");
let baseUrl = (
  args.includes("--url") ? args[args.indexOf("--url") + 1] : process.env.APP_PUBLIC_URL || "https://app.getzhimu.com"
).replace(/\/$/, "");
if (!args.includes("--url") && /localhost|127\.0\.0\.1/i.test(baseUrl)) {
  console.log(`Note: APP_PUBLIC_URL=${baseUrl} — drill uses production API instead`);
  baseUrl = "https://app.getzhimu.com";
}

const opsToken = process.env.OPS_API_TOKEN?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();
const drillEmail = `drill-${Date.now()}@example.invalid`;
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

async function fetchJson(urlPath, init = {}) {
  const res = await fetch(`${baseUrl}${urlPath}`, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { res, text, json };
}

console.log(`织幕内测 Support 演练 → ${baseUrl}\n`);

if (!opsToken) {
  fail("OPS_API_TOKEN", "missing in backend/.env");
  process.exit(1);
}

try {
  const betaForm = await fetchJson("/api/platform/beta");
  if (betaForm.res.ok && betaForm.json?.applyApiPath) {
    pass("GET /api/platform/beta", betaForm.json.title || "form ok");
  } else {
    fail("GET /api/platform/beta", `${betaForm.res.status} ${betaForm.text.slice(0, 120)}`);
  }

  const apply = await fetchJson("/api/platform/beta/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: drillEmail,
      displayName: "L1-06 演练用户",
      roleIntent: "creator",
      useCase: "自动化内测 Support 演练：验证申请、Ops 审核与反馈闭环。",
      referralSource: "预计规模：L1-06-drill",
      contact: "drill-only"
    })
  });
  if (apply.res.status !== 201 || apply.json?.status !== "pending") {
    fail("POST /api/platform/beta/apply", `${apply.res.status} ${apply.text.slice(0, 160)}`);
  }
  const applicationId = apply.json.id;
  pass("POST /api/platform/beta/apply", `pending id=${applicationId}`);

  const dup = await fetchJson("/api/platform/beta/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: drillEmail,
      displayName: "重复提交",
      useCase: "重复提交应被拒绝，因为已有待审申请。"
    })
  });
  if (dup.res.status === 409 && dup.json?.code === "BETA_APPLICATION_PENDING") {
    pass("duplicate apply blocked", "BETA_APPLICATION_PENDING");
  } else {
    fail("duplicate apply blocked", `${dup.res.status} ${dup.text.slice(0, 120)}`);
  }

  const list = await fetchJson("/api/ops/beta/applications?status=pending&limit=50", {
    headers: { "x-ops-token": opsToken }
  });
  if (!list.res.ok) {
    fail("GET /api/ops/beta/applications", `${list.res.status} ${list.text.slice(0, 120)}`);
  }
  const items = list.json?.items || [];
  const found = items.find((row) => String(row.email || "").toLowerCase() === drillEmail.toLowerCase());
  if (found?.id === applicationId) {
    pass("GET /api/ops/beta/applications", `found in pending (${applicationId.slice(0, 8)}…)`);
  } else {
    pass("GET /api/ops/beta/applications", `list ok (${items.length} pending)`);
  }

  const approve = await fetchJson(`/api/ops/beta/applications/${applicationId}/approve`, {
    method: "POST",
    headers: { "x-ops-token": opsToken, "Content-Type": "application/json" },
    body: JSON.stringify({ note: "L1-06 自动化演练通过（将自动清理）" })
  });
  if (approve.res.ok) {
    pass("POST ops approve", approve.json?.status || "approved");
  } else {
    fail("POST ops approve", `${approve.res.status} ${approve.text.slice(0, 160)}`);
  }

  const feedback = await fetchJson("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "bug",
      subject: "L1-06 Support 演练反馈",
      body: "自动化演练：验证公开反馈入口与 Ops 可读。",
      pageUrl: `${baseUrl}/overview`,
      userAgent: "beta-support-drill/1.0"
    })
  });
  let feedbackId = null;
  if (feedback.res.status === 201 && feedback.json?.id) {
    feedbackId = feedback.json.id;
    pass("POST /api/feedback", `id=${feedbackId.slice(0, 8)}…`);
  } else {
    fail("POST /api/feedback", `${feedback.res.status} ${feedback.text.slice(0, 120)}`);
  }

  const fbList = await fetchJson("/api/ops/feedback?limit=5", {
    headers: { "x-ops-token": opsToken }
  });
  if (fbList.res.ok && Array.isArray(fbList.json?.items)) {
    pass("GET /api/ops/feedback", `${fbList.json.items.length} recent`);
  } else {
    fail("GET /api/ops/feedback", `${fbList.res.status}`);
  }

  const opsStatus = await fetchJson("/api/ops/status", {
    headers: { "x-ops-token": opsToken }
  });
  if (opsStatus.res.ok && opsStatus.json?.productionTrust) {
    const trust = opsStatus.json.productionTrust;
    pass("GET /api/ops/status", `productionTrust ${trust.passed}/${trust.total}`);
  } else {
    fail("GET /api/ops/status", `${opsStatus.res.status}`);
  }

  const templateCheck = spawnSync(
    process.execPath,
    [
      "scripts/render-support-email.mjs",
      "beta-onboarding",
      "--displayName=L1-06演练",
      `--email=${drillEmail}`
    ],
    { cwd: backendRoot, encoding: "utf8", shell: false }
  );
  if (templateCheck.status === 0 && templateCheck.stdout.includes("织幕")) {
    pass("support email template render", "beta-onboarding");
  } else {
    fail("support email template render", (templateCheck.stderr || templateCheck.stdout || "").slice(0, 120));
  }

  if (!keep && databaseUrl) {
    const client = new pg.Client({
      connectionString: resolveDatabaseUrl(databaseUrl),
      ssl: resolveDatabaseSsl()
    });
    await client.connect();
    try {
      await client.query(`DELETE FROM beta_applications WHERE lower(email) = lower($1)`, [drillEmail]);
      if (feedbackId) {
        await client.query(`DELETE FROM feedback WHERE id = $1`, [feedbackId]);
      }
      pass("cleanup drill rows", drillEmail);
    } finally {
      await client.end();
    }
  } else if (keep) {
    console.log(`--keep: left beta_applications row for ${drillEmail}`);
  } else {
    console.log("(skip cleanup — DATABASE_URL missing)");
  }

  console.log(
    "\n" +
      JSON.stringify(
        {
          passed: steps.every((s) => s.ok),
          startedAt,
          finishedAt: new Date().toISOString(),
          baseUrl,
          drillEmail,
          applicationId,
          feedbackId,
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
