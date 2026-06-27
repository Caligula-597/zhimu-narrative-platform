#!/usr/bin/env node
/**
 * Sync security-related Cloudflare configuration for getzhimu.com.
 *
 * Usage:
 *   node scripts/cloudflare-sync-security.mjs
 *   node scripts/cloudflare-sync-security.mjs --bot-fight
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cfRequest, getZoneByName, upsertDnsRecord, verifyToken } from "./cloudflare-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = path.join(root, ".env.railway.setup");
const zoneName = process.env.CLOUDFLARE_ZONE || "getzhimu.com";
const args = new Set(process.argv.slice(2));
const enableBotFight = args.has("--bot-fight");
const reportMailbox = process.env.DMARC_REPORT_MAILBOX || "support@getzhimu.com";
const dmarcRecord = [
  "v=DMARC1",
  "p=quarantine",
  "pct=100",
  "adkim=s",
  "aspf=s",
  `rua=mailto:${reportMailbox}`,
  "fo=1"
].join("; ");

function loadSetup() {
  const env = { ...process.env };
  if (!fs.existsSync(setupPath)) return env;
  for (const line of fs.readFileSync(setupPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    env[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
  }
  return env;
}

async function patchZoneSetting(token, zoneId, setting, value) {
  return cfRequest(token, `/zones/${zoneId}/settings/${setting}`, {
    method: "PATCH",
    body: { value }
  });
}

async function main() {
  const setup = loadSetup();
  const token = setup.CLOUDFLARE_API_TOKEN?.trim() || process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) throw new Error("Missing CLOUDFLARE_API_TOKEN in environment or .env.railway.setup");

  await verifyToken(token);
  const zone = await getZoneByName(token, zoneName);
  if (!zone) throw new Error(`Zone not found: ${zoneName}`);

  const rootDmarc = await upsertDnsRecord(token, zone.id, {
    type: "TXT",
    name: "_dmarc",
    zoneName,
    content: dmarcRecord,
    proxied: false,
    ttl: 300
  });
  console.log(`DMARC _dmarc.${zoneName} updated (${rootDmarc.id})`);

  const mailDmarc = await upsertDnsRecord(token, zone.id, {
    type: "TXT",
    name: "_dmarc.mail",
    zoneName,
    content: dmarcRecord,
    proxied: false,
    ttl: 300
  });
  console.log(`DMARC _dmarc.mail.${zoneName} updated (${mailDmarc.id})`);

  if (enableBotFight) {
    try {
      const result = await patchZoneSetting(token, zone.id, "bot_fight_mode", "on");
      console.log(`Cloudflare Bot Fight Mode: ${result.value}`);
    } catch (error) {
      console.warn(`WARN Bot Fight Mode could not be enabled: ${error.message}`);
      console.warn("Enable it manually in Cloudflare Security > Bots if your plan exposes this setting.");
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
