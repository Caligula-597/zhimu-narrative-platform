#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getZoneByName, listDnsRecords, upsertDnsRecord, verifyToken } from "./cloudflare-api.mjs";
import { railwayGraphql } from "./railway-api.mjs";

const setupPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.railway.setup");

function loadSetup() {
  const env = {};
  for (const line of fs.readFileSync(setupPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const setup = loadSetup();
const cfToken = setup.CLOUDFLARE_API_TOKEN;
const railwayToken = setup.RAILWAY_TOKEN;

console.log("1 verify cf");
await verifyToken(cfToken);

console.log("2 railway domains");
const data = await railwayGraphql(railwayToken, `query {
  domains(projectId: "26f5bb70-1688-4e0b-a414-5c03f16ed95b", environmentId: "e3b187d0-75ba-49a3-ba92-16168dd5fb68", serviceId: "fc78dfb7-98dc-4ca5-8a9e-4cb9a9db80b1") {
    customDomains { domain status { dnsRecords { requiredValue } verificationToken } }
  }
}`);
const app = data.domains.customDomains.find((d) => d.domain === "app.getzhimu.com");
const cname = app?.status?.dnsRecords?.[0]?.requiredValue;
const txt = app?.status?.verificationToken;
console.log("cname", cname);

console.log("3 zone");
const zone = await getZoneByName(cfToken, "getzhimu.com");
console.log("zone", zone.id);

console.log("4 upsert cname");
try {
  const r = await upsertDnsRecord(cfToken, zone.id, { type: "CNAME", name: "app", content: cname, proxied: true });
  console.log("cname ok", r.id);
} catch (e) {
  console.log("cname fail", e.message);
}

console.log("5 upsert txt");
try {
  const r = await upsertDnsRecord(cfToken, zone.id, { type: "TXT", name: "_railway-verify.app", content: txt, proxied: false });
  console.log("txt ok", r.id);
} catch (e) {
  console.log("txt fail", e.message);
}
