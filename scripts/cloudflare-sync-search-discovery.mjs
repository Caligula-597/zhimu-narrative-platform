#!/usr/bin/env node
/**
 * Sync Cloudflare discovery settings for getzhimu.com:
 * - www → apex permanent redirect (Single Redirect)
 * - Crawler Hints on (IndexNow participation at the edge)
 *
 * Usage:
 *   npm run cloudflare:sync-search-discovery
 *   npm run cloudflare:sync-search-discovery -- --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cfRequest, getZoneByName, verifyToken } from "./cloudflare-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = path.join(root, ".env.railway.setup");
const zoneName = process.env.CLOUDFLARE_ZONE || "getzhimu.com";
const apexOrigin = `https://${zoneName}`;
const wwwHost = `www.${zoneName}`;
const dryRun = process.argv.includes("--dry-run");
const RULE_DESCRIPTION = "zhimu www to apex permanent redirect";

function loadSetup() {
  const env = { ...process.env };
  if (!fs.existsSync(setupPath)) return env;
  for (const line of fs.readFileSync(setupPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    env[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
  }
  return env;
}

function buildWwwRedirectRule() {
  return {
    description: RULE_DESCRIPTION,
    expression: `(http.host eq "${wwwHost}")`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: {
          expression: `concat("${apexOrigin}", http.request.uri.path)`
        },
        preserve_query_string: true
      }
    },
    enabled: true
  };
}

async function ensureWwwRedirect(token, zoneId) {
  const phase = "http_request_dynamic_redirect";
  const entrypoint = await cfRequest(token, `/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`);
  const rules = Array.isArray(entrypoint.rules) ? [...entrypoint.rules] : [];
  const nextRule = buildWwwRedirectRule();
  const existingIndex = rules.findIndex((rule) => rule.description === RULE_DESCRIPTION);
  if (existingIndex >= 0) {
    rules[existingIndex] = { ...rules[existingIndex], ...nextRule, id: rules[existingIndex].id };
  } else {
    rules.unshift(nextRule);
  }

  if (dryRun) {
    console.log(`[dry-run] would upsert ${phase} rule for ${wwwHost} → ${apexOrigin}`);
    return entrypoint;
  }

  return cfRequest(token, `/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`, {
    method: "PUT",
    body: { rules }
  });
}

async function ensureCrawlerHints(token, zoneId) {
  if (dryRun) {
    console.log("[dry-run] would set zone setting crawler_hints=on");
    return null;
  }
  return cfRequest(token, `/zones/${zoneId}/settings/crawler_hints`, {
    method: "PATCH",
    body: { value: "on" }
  });
}

async function main() {
  const setup = loadSetup();
  const token = setup.CLOUDFLARE_API_TOKEN?.trim() || process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) throw new Error("Missing CLOUDFLARE_API_TOKEN in environment or .env.railway.setup");

  await verifyToken(token);
  const zone = await getZoneByName(token, zoneName);
  if (!zone) throw new Error(`Zone not found: ${zoneName}`);

  await ensureWwwRedirect(token, zone.id);
  console.log(`www redirect ready: https://${wwwHost}/* → ${apexOrigin}/* (301, preserve query)`);

  const hints = await ensureCrawlerHints(token, zone.id);
  const hintsValue = hints?.value || (dryRun ? "on (dry-run)" : "on");
  console.log(`Crawler Hints: ${hintsValue}`);
  console.log(dryRun ? "Dry-run complete." : "Cloudflare search discovery sync complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
