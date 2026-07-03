#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyClashProxyEnv } from "./clash-proxy.mjs";

await applyClashProxyEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of fs.readFileSync(path.join(root, "backend", ".env"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

for (const url of ["https://ops.getzhimu.com/", "https://app.getzhimu.com/api/health/ready"]) {
  try {
    const res = await fetch(url);
    console.log(`${url} -> ${res.status}`);
    if (url.includes("ops")) console.log(await res.text());
    else console.log(JSON.stringify(await res.json(), null, 2));
  } catch (error) {
    console.log(`${url} -> ERR ${error.message}`);
  }
}

if (env.OPS_API_TOKEN) {
  const res = await fetch("https://app.getzhimu.com/api/ops/status", {
    headers: { "x-ops-token": env.OPS_API_TOKEN }
  });
  console.log(`ops/status -> ${res.status}`);
  if (res.ok) {
    const body = await res.json();
    const trust = body.productionTrust;
    console.log(`productionTrust ${trust?.passed}/${trust?.total} ready=${trust?.ready}`);
    for (const gate of trust?.gates ?? []) {
      console.log(`${gate.ok ? "OK" : "NO"} ${gate.key}: ${gate.detail}`);
    }
  }
}
