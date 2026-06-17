#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = path.join(root, ".env.railway.setup");
const PAGES_PROJECT = "zhimu-site";
const ROOT_DOMAIN = "getzhimu.com";

function loadSetup() {
  const env = { ...process.env };
  for (const line of fs.readFileSync(setupPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

async function ensurePagesProject(cfToken, accountId) {
  const projects = await listPagesProjects(cfToken, accountId);
  let project = projects.find((p) => p.name === PAGES_PROJECT);
  if (!project) {
    console.log(`[pages] creating ${PAGES_PROJECT}…`);
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
    console.log(`[pages] project exists: ${project.name}`);
  }
  return project;
}

async function main() {
  const setup = loadSetup();
  const cfToken = setup.CLOUDFLARE_API_TOKEN?.trim();
  if (!cfToken) throw new Error("Missing CLOUDFLARE_API_TOKEN");

  await verifyToken(cfToken);
  const accountId = setup.CLOUDFLARE_ACCOUNT_ID?.trim()
    || (await cfRequest(cfToken, "/accounts"))?.[0]?.id;
  if (!accountId) throw new Error("Cannot resolve account ID");

  await ensurePagesProject(cfToken, accountId);

  for (const domain of [ROOT_DOMAIN, `www.${ROOT_DOMAIN}`]) {
    try {
      await addPagesDomain(cfToken, accountId, PAGES_PROJECT, domain);
      console.log(`[pages] domain added: ${domain}`);
    } catch (error) {
      if (/already exists|duplicate/i.test(error.message)) {
        console.log(`[pages] domain already set: ${domain}`);
      } else {
        throw error;
      }
    }
  }

  const zone = await getZoneByName(cfToken, ROOT_DOMAIN);
  if (zone) {
    await upsertDnsRecord(cfToken, zone.id, {
      type: "CNAME",
      name: ROOT_DOMAIN,
      zoneName: ROOT_DOMAIN,
      content: `${PAGES_PROJECT}.pages.dev`,
      proxied: true
    });
    console.log(`[pages] root CNAME → ${PAGES_PROJECT}.pages.dev`);
  }

  console.log("✅ Pages sync done");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
