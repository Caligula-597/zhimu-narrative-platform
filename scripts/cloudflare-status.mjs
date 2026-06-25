#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cfRequest, deleteDnsRecord, getZoneByName, listDnsRecords } from "./cloudflare-api.mjs";

const setupPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.railway.setup");
const token = fs.readFileSync(setupPath, "utf8").match(/^CLOUDFLARE_API_TOKEN=(.+)$/m)?.[1]?.trim();
const zone = await getZoneByName(token, "getzhimu.com");

const records = await listDnsRecords(token, zone.id, { name: "getzhimu.com" });
console.log("ROOT DNS:");
for (const r of records) {
  console.log(`  ${r.type} ${r.name} → ${r.content} (proxied=${r.proxied}) id=${r.id}`);
}

for (const name of ["app", "play", "host"]) {
  const fqdn = `${name}.getzhimu.com`;
  const domainRecords = await listDnsRecords(token, zone.id, { name: fqdn });
  console.log(`\n${name.toUpperCase()} DNS:`);
  if (!domainRecords.length) console.log("  missing");
  for (const r of domainRecords) {
    console.log(`  ${r.type} ${r.name} → ${r.content} (proxied=${r.proxied})`);
  }
}

const accounts = await cfRequest(token, "/accounts");
const accountId = accounts[0]?.id;
const projects = await cfRequest(token, `/accounts/${accountId}/pages/projects`);
for (const projectName of ["zhimu-site", "zhimu-play", "zhimu-host"]) {
  const project = projects.find((p) => p.name === projectName);
  console.log(`\nPAGES ${projectName}:`);
  if (!project) {
    console.log("  missing");
    continue;
  }
  console.log(`  subdomain: ${project.subdomain}`);
  console.log(`  root_dir: ${project.build_config?.root_dir || "?"}`);
  console.log(`  latest_deployment: ${project.latest_deployment?.url ?? "none"}`);
  try {
    const domains = await cfRequest(token, `/accounts/${accountId}/pages/projects/${projectName}/domains`);
    for (const d of domains) {
      console.log(`  domain: ${d.name} status=${d.status ?? d.validation_data?.status ?? "?"}`);
    }
  } catch (e) {
    console.log("  domains:", e.message);
  }
}

// Remove conflicting root A record if Pages is configured
const rootA = records.filter((r) => r.type === "A" && r.name === "getzhimu.com");
if (rootA.length && process.argv.includes("--fix-root")) {
  for (const r of rootA) {
    await deleteDnsRecord(token, zone.id, r.id);
    console.log(`\nDeleted root A record ${r.content}`);
  }
}
