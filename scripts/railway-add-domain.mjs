#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { railwayGraphql } from "./railway-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = path.join(root, ".env.railway.setup");

const PROJECT_ID = "26f5bb70-1688-4e0b-a414-5c03f16ed95b";
const ENVIRONMENT_ID = "e3b187d0-75ba-49a3-ba92-16168dd5fb68";
const SERVICE_ID = "fc78dfb7-98dc-4ca5-8a9e-4cb9a9db80b1";

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

async function listDomains(token) {
  const data = await railwayGraphql(
    token,
    `query($projectId: String!, $environmentId: String!, $serviceId: String!) {
      domains(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) {
        customDomains {
          id domain
          status {
            certificateStatus
            verificationDnsHost
            verificationToken
            dnsRecords { hostlabel requiredValue currentValue status }
          }
        }
      }
    }`,
    { projectId: PROJECT_ID, environmentId: ENVIRONMENT_ID, serviceId: SERVICE_ID }
  );
  return data.domains?.customDomains ?? [];
}

async function addDomain(token, domain) {
  const data = await railwayGraphql(
    token,
    `mutation($input: CustomDomainCreateInput!) {
      customDomainCreate(input: $input) {
        id domain
        status {
          certificateStatus
          verificationDnsHost
          verificationToken
          dnsRecords { hostlabel requiredValue currentValue status }
        }
      }
    }`,
    {
      input: {
        projectId: PROJECT_ID,
        environmentId: ENVIRONMENT_ID,
        serviceId: SERVICE_ID,
        domain
      }
    }
  );
  return data.customDomainCreate;
}

async function deleteDomain(token, id) {
  await railwayGraphql(
    token,
    `mutation($id: String!) {
      customDomainDelete(id: $id)
    }`,
    { id }
  );
}

const domainArg = process.argv[2]?.trim() || "app.getzhimu.com";
const replaceRoot = process.argv.includes("--replace-root");
const env = loadSetup();
const token = env.RAILWAY_ACCOUNT_TOKEN?.trim() || env.RAILWAY_TOKEN?.trim();
if (!token) {
  console.error("Missing RAILWAY_ACCOUNT_TOKEN in .env.railway.setup");
  process.exit(1);
}

const existing = await listDomains(token);
const found = existing.find((d) => d.domain === domainArg);
if (found) {
  console.log(JSON.stringify({ action: "already_exists", domain: found }, null, 2));
  process.exit(0);
}

if (replaceRoot) {
  const root = existing.find((d) => d.domain === "getzhimu.com");
  if (root) {
    await deleteDomain(token, root.id);
    console.log(JSON.stringify({ action: "deleted", domain: root.domain, id: root.id }, null, 2));
  }
}

const created = await addDomain(token, domainArg);
console.log(JSON.stringify({ action: "created", domain: created }, null, 2));
