#!/usr/bin/env node
/**
 * Deploy deploy/ops-bridge-worker.js to Cloudflare Workers and print env URLs for Railway.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cfRequest } from "./cloudflare-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = path.join(root, ".env.railway.setup");
const backendEnvPath = path.join(root, "backend", ".env");
const workerPath = path.join(root, "deploy", "ops-bridge-worker.js");
const SCRIPT_NAME = "zhimu-ops-bridge";

function loadSetup() {
  const env = { ...process.env };
  if (fs.existsSync(setupPath)) {
    for (const line of fs.readFileSync(setupPath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      if (!env[k]) env[k] = t.slice(i + 1).trim();
    }
  }
  return env;
}

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function upsertEnvLines(filePath, entries) {
  let text = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  for (const [key, value] of Object.entries(entries)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(text)) text = text.replace(re, line);
    else text = `${text.replace(/\s*$/, "")}\n${line}\n`;
  }
  fs.writeFileSync(filePath, text, "utf8");
}

async function deployWorker(token, accountId, bindings) {
  const script = fs.readFileSync(workerPath, "utf8");
  const metadata = {
    main_module: "ops-bridge-worker.js",
    compatibility_date: "2024-12-01",
    bindings: bindings.map((b) => ({ type: b.type, name: b.name, ...(b.text ? { text: b.text } : {}) }))
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("ops-bridge-worker.js", new Blob([script], { type: "application/javascript+module" }), "ops-bridge-worker.js");

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${SCRIPT_NAME}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const body = await res.json();
  if (!body.success) {
    throw new Error(body.errors?.map((e) => e.message).join("; ") || "Worker upload failed");
  }

  await cfRequest(token, `/accounts/${accountId}/workers/scripts/${SCRIPT_NAME}/subdomain`, {
    method: "POST",
    body: { enabled: true }
  });

  const { getZoneByName, upsertDnsRecord } = await import("./cloudflare-api.mjs");
  const zone = await getZoneByName(token, "getzhimu.com");
  try {
    await cfRequest(token, `/zones/${zone.id}/workers/routes`, {
      method: "POST",
      body: { pattern: "ops.getzhimu.com/*", script: SCRIPT_NAME }
    });
  } catch (error) {
    if (!/already exists/i.test(error.message)) throw error;
  }
  await upsertDnsRecord(token, zone.id, {
    type: "AAAA",
    name: "ops",
    content: "100::",
    proxied: true,
    zoneName: "getzhimu.com"
  });

  return "https://ops.getzhimu.com";
}

async function main() {
  const setup = loadSetup();
  const token = setup.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN missing in .env.railway.setup");

  const backendEnv = parseEnvFile(backendEnvPath);
  const bridgeSecret = backendEnv.BRIDGE_WEBHOOK_SECRET?.trim() || crypto.randomBytes(24).toString("base64url");

  const accounts = await cfRequest(token, "/accounts");
  const accountId = setup.CLOUDFLARE_ACCOUNT_ID?.trim() || accounts[0]?.id;
  if (!accountId) throw new Error("Cloudflare account id not found");

  const bindings = [
    { type: "plain_text", name: "BRIDGE_SECRET", text: bridgeSecret },
    { type: "plain_text", name: "RESEND_API_KEY", text: backendEnv.RESEND_API_KEY || "" },
    { type: "plain_text", name: "MAIL_FROM", text: backendEnv.MAIL_FROM || "织幕 <noreply@mail.getzhimu.com>" },
    { type: "plain_text", name: "ALERT_EMAIL", text: backendEnv.ALERT_EMAIL || backendEnv.ADMIN_EMAIL || "admin@getzhimu.com" }
  ];

  console.log("[cf-ops-bridge] deploying worker…");
  const baseUrl = await deployWorker(token, accountId, bindings);
  if (!baseUrl) throw new Error("Worker deployed but subdomain URL missing");

  const envPatch = {
    ALERT_WEBHOOK_URL: `${baseUrl}/alert`,
    ALERT_WEBHOOK_SECRET: bridgeSecret,
    UPLOAD_SCAN_MODE: "strict",
    UPLOAD_SCAN_WEBHOOK_URL: `${baseUrl}/upload-scan`,
    UPLOAD_SCAN_WEBHOOK_SECRET: bridgeSecret,
    OTEL_ENABLED: "true",
    OTEL_SERVICE_NAME: "zhimu-api",
    OTEL_EXPORTER_OTLP_ENDPOINT: baseUrl,
    BRIDGE_WEBHOOK_SECRET: bridgeSecret
  };

  upsertEnvLines(backendEnvPath, envPatch);

  const outPath = path.join(root, "config", "ops-bridge.env.generated");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    `# Generated ${new Date().toISOString()} — paste-safe summary (secrets redacted in logs)\n` +
      Object.entries(envPatch)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") +
      "\n",
    "utf8"
  );

  console.log("[cf-ops-bridge] deployed:", baseUrl);
  console.log("[cf-ops-bridge] updated backend/.env with alert / upload-scan / otlp URLs");
  console.log("[cf-ops-bridge] summary written to config/ops-bridge.env.generated");
}

main().catch((err) => {
  console.error("[cf-ops-bridge] failed:", err.message);
  process.exit(1);
});
