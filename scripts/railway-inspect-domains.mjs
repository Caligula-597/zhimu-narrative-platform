#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getProject, railwayGraphql } from "./railway-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = path.join(root, ".env.railway.setup");

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

async function inspectService(token, projectId, environmentId, serviceId) {
  const data = await railwayGraphql(
    token,
    `query($projectId: String!, $environmentId: String!, $serviceId: String!) {
      domains(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) {
        serviceDomains { id domain suffix targetPort }
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
      serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
        source { repo image }
        builder
        rootDirectory
        dockerfilePath
        startCommand
        healthcheckPath
        latestDeployment { id status createdAt staticUrl }
      }
    }`,
    { projectId, environmentId, serviceId }
  );
  return data;
}

async function main() {
  const env = loadSetup();
  const token = env.RAILWAY_ACCOUNT_TOKEN?.trim() || env.RAILWAY_TOKEN?.trim();
  if (!token) {
    console.error("Missing RAILWAY_ACCOUNT_TOKEN in .env.railway.setup");
    process.exit(1);
  }

  const projectId = env.RAILWAY_PROJECT_ID?.trim() || "26f5bb70-1688-4e0b-a414-5c03f16ed95b";
  const serviceId = env.RAILWAY_API_SERVICE_ID?.trim() || "fc78dfb7-98dc-4ca5-8a9e-4cb9a9db80b1";

  const project = await getProject(token, projectId);
  const production =
    project.environments?.edges?.map((e) => e.node).find((e) => e.name === "production")
    ?? project.environments?.edges?.[0]?.node;

  const services = project.services?.edges?.map((e) => e.node) ?? [];
  const apiService = services.find((s) => s.id === serviceId) ?? services[0];

  console.log(JSON.stringify({
    project: { id: project.id, name: project.name },
    environment: production,
    services: services.map((s) => ({ id: s.id, name: s.name })),
    apiService: apiService ? { id: apiService.id, name: apiService.name } : null
  }, null, 2));

  if (!production || !apiService) return;

  try {
    const detail = await inspectService(token, projectId, production.id, apiService.id);
    console.log("\nSERVICE_DETAIL");
    console.log(JSON.stringify(detail, null, 2));
  } catch (error) {
    console.error("\nSERVICE_QUERY_FAILED:", error.message);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
