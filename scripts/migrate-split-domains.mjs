#!/usr/bin/env node
/**
 * Split-domain migration:
 *   getzhimu.com      → Cloudflare Pages (site/)
 *   app.getzhimu.com  → Railway fullstack
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  addPagesDomain,
  createPagesProject,
  getZoneByName,
  listPagesProjects,
  upsertDnsRecord,
  verifyToken
} from "./cloudflare-api.mjs";
import { cfRequest } from "./cloudflare-api.mjs";
import { railwayGraphql } from "./railway-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = path.join(root, ".env.railway.setup");

const ZONE_NAME = "getzhimu.com";
const APP_DOMAIN = "app.getzhimu.com";
const ROOT_DOMAIN = "getzhimu.com";
const PAGES_PROJECT = "zhimu-site";
const RAILWAY_PROJECT_ID = "26f5bb70-1688-4e0b-a414-5c03f16ed95b";
const RAILWAY_ENV_ID = "e3b187d0-75ba-49a3-ba92-16168dd5fb68";
const RAILWAY_SERVICE_ID = "fc78dfb7-98dc-4ca5-8a9e-4cb9a9db80b1";

function loadSetup() {
  const env = { ...process.env };
  if (!fs.existsSync(setupPath)) return env;
  for (const line of fs.readFileSync(setupPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function run(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...extraEnv }
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function getRailwayAppDomainInfo(railwayToken) {
  const data = await railwayGraphql(
    railwayToken,
    `query($projectId: String!, $environmentId: String!, $serviceId: String!) {
      domains(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) {
        customDomains {
          domain
          status {
            dnsRecords { requiredValue }
            verificationToken
          }
        }
      }
    }`,
    { projectId: RAILWAY_PROJECT_ID, environmentId: RAILWAY_ENV_ID, serviceId: RAILWAY_SERVICE_ID }
  );
  const app = data.domains?.customDomains?.find((d) => d.domain === APP_DOMAIN);
  return {
    cname: app?.status?.dnsRecords?.[0]?.requiredValue || "hdlf861g.up.railway.app",
    verifyToken: app?.status?.verificationToken || ""
  };
}

async function ensurePagesProject(cfToken, accountId) {
  let projects = await listPagesProjects(cfToken, accountId);
  let project = projects.find((p) => p.name === PAGES_PROJECT);
  if (!project) {
    console.log(`[cf] creating Pages project ${PAGES_PROJECT}…`);
    project = await createPagesProject(cfToken, accountId, {
      name: PAGES_PROJECT,
      production_branch: "main",
      build_config: {
        root_dir: "site",
        build_command: "npm ci && npm run build",
        destination_dir: "dist"
      },
      source: {
        type: "github",
        config: {
          owner: "Caligula-597",
          repo_name: "zhimu-narrative-platform",
          production_branch: "main",
          pr_comments_enabled: false,
          deployments_enabled: true,
          production_deployments_enabled: true
        }
      }
    });
  } else {
    console.log(`[cf] Pages project exists: ${project.name}`);
  }
  return project;
}

async function syncCloudflare(cfToken, accountId, { cname, verifyToken }) {
  const zone = await getZoneByName(cfToken, ZONE_NAME);
  if (!zone) throw new Error(`Cloudflare zone not found: ${ZONE_NAME}`);
  console.log(`[cf] zone ${zone.name}`);

  await upsertDnsRecord(cfToken, zone.id, {
    type: "CNAME",
    name: "app",
    content: cname,
    proxied: true
  });
  console.log(`[cf] CNAME app → ${cname}`);

  if (verifyToken) {
    await upsertDnsRecord(cfToken, zone.id, {
      type: "TXT",
      name: "_railway-verify.app",
      content: verifyToken,
      proxied: false
    });
    console.log("[cf] TXT _railway-verify.app updated");
  }

  await ensurePagesProject(cfToken, accountId);
  try {
    await addPagesDomain(cfToken, accountId, PAGES_PROJECT, ROOT_DOMAIN);
    console.log(`[cf] Pages custom domain added: ${ROOT_DOMAIN}`);
  } catch (error) {
    if (/already exists|duplicate/i.test(error.message)) {
      console.log(`[cf] Pages domain already configured: ${ROOT_DOMAIN}`);
    } else {
      throw error;
    }
  }
  try {
    await addPagesDomain(cfToken, accountId, PAGES_PROJECT, `www.${ROOT_DOMAIN}`);
    console.log(`[cf] Pages custom domain added: www.${ROOT_DOMAIN}`);
  } catch (error) {
    if (!/already exists|duplicate/i.test(error.message)) {
      console.warn(`[cf] www domain: ${error.message}`);
    }
  }
}

async function main() {
  const setup = loadSetup();
  const railwayToken = setup.RAILWAY_ACCOUNT_TOKEN?.trim() || setup.RAILWAY_TOKEN?.trim();
  const cfToken = setup.CLOUDFLARE_API_TOKEN?.trim() || process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!railwayToken) {
    console.error("Missing RAILWAY_ACCOUNT_TOKEN in .env.railway.setup");
    process.exit(1);
  }

  console.log("=== Step 1: build marketing site ===");
  run(process.execPath, ["scripts/migrate-split-domains-build.mjs"]);

  console.log("\n=== Step 2: Railway domain swap ===");
  run(process.execPath, ["scripts/railway-add-domain.mjs", APP_DOMAIN, "--replace-root"]);

  console.log("\n=== Step 3: Railway env push ===");
  run(process.execPath, ["scripts/railway-push-env.mjs"], {
    RAILWAY_APP_PUBLIC_URL: `https://${APP_DOMAIN}`,
    MARKETING_SITE_ORIGIN: `https://${ROOT_DOMAIN},https://www.${ROOT_DOMAIN}`,
    MARKETING_SITE_URL: `https://${ROOT_DOMAIN}`
  });

  const railwayInfo = await getRailwayAppDomainInfo(railwayToken);
  console.log("\n=== Step 4: Cloudflare sync ===");
  if (!cfToken) {
    console.warn(`
[cf] 跳过：未设置 CLOUDFLARE_API_TOKEN

请在 .env.railway.setup 添加：
  CLOUDFLARE_API_TOKEN=...   # https://dash.cloudflare.com/profile/api-tokens
  CLOUDFLARE_ACCOUNT_ID=...  # 可选

然后手动在 Cloudflare：
  1. Pages → ${PAGES_PROJECT}（或新建）→ Root directory = site，Output = dist
  2. 绑定自定义域 ${ROOT_DOMAIN}
  3. DNS: app CNAME → ${railwayInfo.cname}
`);
    return;
  }

  const verified = await verifyToken(cfToken);
  const accountId = setup.CLOUDFLARE_ACCOUNT_ID?.trim()
    || verified.id
    || (await cfRequest(cfToken, "/accounts"))?.[0]?.id;
  if (!accountId) throw new Error("Cannot resolve Cloudflare account ID");

  await syncCloudflare(cfToken, accountId, railwayInfo);
  console.log("\n✅ Split-domain migration complete");
  console.log(`   ${ROOT_DOMAIN} → Cloudflare Pages (${PAGES_PROJECT})`);
  console.log(`   ${APP_DOMAIN} → Railway (${railwayInfo.cname})`);
}

main().catch((error) => {
  console.error("[migrate]", error.message);
  process.exit(1);
});
