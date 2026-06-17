#!/usr/bin/env node
/**
 * Sync Cloudflare DNS for split-domain setup (requires CLOUDFLARE_API_TOKEN).
 *
 * Usage:
 *   node scripts/cloudflare-sync-dns.mjs
 *   node scripts/cloudflare-sync-dns.mjs --cname vr7sq15u.up.railway.app --txt "railway-verify=..."
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getZoneByName, listDnsRecords, upsertDnsRecord, verifyToken } from "./cloudflare-api.mjs";
import { railwayGraphql } from "./railway-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = path.join(root, ".env.railway.setup");
const ZONE = "getzhimu.com";

function loadSetup() {
  const env = { ...process.env };
  if (fs.existsSync(setupPath)) {
    for (const line of fs.readFileSync(setupPath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  }
  return env;
}

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function railwayTargets(token) {
  const data = await railwayGraphql(
    token,
    `query {
      domains(
        projectId: "26f5bb70-1688-4e0b-a414-5c03f16ed95b"
        environmentId: "e3b187d0-75ba-49a3-ba92-16168dd5fb68"
        serviceId: "fc78dfb7-98dc-4ca5-8a9e-4cb9a9db80b1"
      ) {
        customDomains {
          domain
          status {
            dnsRecords { requiredValue }
            verificationToken
          }
        }
      }
    }`
  );
  const app = data.domains?.customDomains?.find((d) => d.domain === "app.getzhimu.com");
  return {
    cname: arg("cname") || app?.status?.dnsRecords?.[0]?.requiredValue,
    txt: arg("txt") || app?.status?.verificationToken
  };
}

async function main() {
  const setup = loadSetup();
  const cfToken = setup.CLOUDFLARE_API_TOKEN?.trim() || process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!cfToken) {
    console.error(`缺少 CLOUDFLARE_API_TOKEN（写入 .env.railway.setup）`);
    process.exit(1);
  }

  const railwayToken = setup.RAILWAY_ACCOUNT_TOKEN?.trim() || setup.RAILWAY_TOKEN?.trim();
  const { cname, txt } = await railwayTargets(railwayToken);
  if (!cname) throw new Error("Cannot resolve Railway CNAME target");

  await verifyToken(cfToken);
  const zone = await getZoneByName(cfToken, ZONE);
  if (!zone) throw new Error(`Zone not found: ${ZONE}`);

  const appCname = await upsertDnsRecord(cfToken, zone.id, {
    type: "CNAME",
    name: "app",
    zoneName: ZONE,
    content: cname,
    proxied: true
  });
  console.log(`CNAME app.${ZONE} → ${cname} (${appCname.id})`);

  if (txt) {
    const verify = await upsertDnsRecord(cfToken, zone.id, {
      type: "TXT",
      name: "_railway-verify.app",
      zoneName: ZONE,
      content: txt,
      proxied: false
    });
    console.log(`TXT _railway-verify.app.${ZONE} updated (${verify.id})`);
  }

  const rootRecords = await listDnsRecords(cfToken, zone.id, { name: ZONE });
  const rootA = rootRecords.filter((r) => r.type === "A" && r.name === ZONE);
  if (rootA.length) {
    console.warn(`根域仍有 A 记录 (${rootA.map((r) => r.content).join(", ")})。`);
    console.warn("请在 Cloudflare Pages 绑定 getzhimu.com 后，删除旧 A 记录或改为 Pages CNAME。");
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
