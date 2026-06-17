#!/usr/bin/env node
/**
 * Cloudflare Pages: zhimu-site (marketing) + zhimu-play (player).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addPagesDomain,
  createPagesProject,
  getZoneByName,
  listPagesProjects,
  upsertDnsRecord,
  verifyToken,
  cfRequest
} from "./cloudflare-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = path.join(root, ".env.railway.setup");
const ROOT_DOMAIN = "getzhimu.com";

const PAGE_PROJECTS = [
  {
    name: "zhimu-site",
    rootDir: "site",
    domains: [ROOT_DOMAIN, `www.${ROOT_DOMAIN}`],
    dns: [{ type: "CNAME", name: ROOT_DOMAIN, content: "zhimu-site.pages.dev" }]
  },
  {
    name: "zhimu-play",
    rootDir: "play",
    domains: [`play.${ROOT_DOMAIN}`],
    dns: [{ type: "CNAME", name: "play", content: "zhimu-play.pages.dev" }]
  }
];

function loadSetup() {
  const env = { ...process.env };
  if (!fs.existsSync(setupPath)) return env;
  for (const line of fs.readFileSync(setupPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

async function ensurePagesProject(cfToken, accountId, spec) {
  const projects = await listPagesProjects(cfToken, accountId);
  let project = projects.find((p) => p.name === spec.name);
  if (!project) {
    console.log(`[pages] creating ${spec.name}…`);
    project = await createPagesProject(cfToken, accountId, {
      name: spec.name,
      production_branch: "main",
      build_config: {
        root_dir: spec.rootDir,
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
    console.log(`[pages] project exists: ${project.name} (root=${project.build_config?.root_dir || "?"})`);
  }
  return project;
}

async function ensureDomains(cfToken, accountId, projectName, domains) {
  for (const domain of domains) {
    try {
      await addPagesDomain(cfToken, accountId, projectName, domain);
      console.log(`[pages] domain added: ${domain} → ${projectName}`);
    } catch (error) {
      if (/already exists|already added|duplicate/i.test(error.message)) {
        console.log(`[pages] domain already set: ${domain} → ${projectName}`);
      } else {
        throw error;
      }
    }
  }
}

async function main() {
  const setup = loadSetup();
  const cfToken = setup.CLOUDFLARE_API_TOKEN?.trim();
  if (!cfToken) throw new Error("Missing CLOUDFLARE_API_TOKEN in .env.railway.setup");

  await verifyToken(cfToken);
  const accountId = setup.CLOUDFLARE_ACCOUNT_ID?.trim()
    || (await cfRequest(cfToken, "/accounts"))?.[0]?.id;
  if (!accountId) throw new Error("Cannot resolve account ID");

  for (const spec of PAGE_PROJECTS) {
    await ensurePagesProject(cfToken, accountId, spec);
    await ensureDomains(cfToken, accountId, spec.name, spec.domains);
  }

  const zone = await getZoneByName(cfToken, ROOT_DOMAIN);
  if (zone) {
    for (const spec of PAGE_PROJECTS) {
      for (const record of spec.dns) {
        await upsertDnsRecord(cfToken, zone.id, {
          type: record.type,
          name: record.name,
          zoneName: ROOT_DOMAIN,
          content: record.content,
          proxied: true
        });
        console.log(`[dns] ${record.name} CNAME → ${record.content}`);
      }
    }
  } else {
    console.warn(`[dns] zone not found: ${ROOT_DOMAIN} — skip DNS upsert`);
  }

  console.log("✅ Pages sync done (zhimu-site + zhimu-play)");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
