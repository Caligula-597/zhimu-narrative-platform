#!/usr/bin/env node
/** Upsert a small set of Railway variables without full railway:push-env. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deployService, getProject, upsertVariables } from "./railway-api.mjs";

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
    const k = t.slice(0, i).trim();
    if (!env[k]) env[k] = t.slice(i + 1).trim();
  }
  return env;
}

const setup = loadSetup();
const token = setup.RAILWAY_ACCOUNT_TOKEN?.trim() || setup.RAILWAY_TOKEN?.trim();
if (!token) {
  console.error("railway-patch-vars: missing RAILWAY_TOKEN in .env.railway.setup");
  process.exit(1);
}

const projectId = setup.RAILWAY_PROJECT_ID?.trim();
const serviceId = setup.RAILWAY_API_SERVICE_ID?.trim();
if (!projectId || !serviceId) {
  console.error("railway-patch-vars: missing RAILWAY_PROJECT_ID or RAILWAY_API_SERVICE_ID");
  process.exit(1);
}

const patch = {};
for (const arg of process.argv.slice(2)) {
  const i = arg.indexOf("=");
  if (i < 1) continue;
  patch[arg.slice(0, i)] = arg.slice(i + 1);
}
if (!Object.keys(patch).length) {
  console.error("Usage: node scripts/railway-patch-vars.mjs KEY=VALUE [--deploy]");
  process.exit(1);
}

const shouldDeploy = process.argv.includes("--deploy");
const project = await getProject(token, projectId);
const production =
  (project.environments?.edges ?? []).map((e) => e.node).find((e) => e.name === "production")
  ?? project.environments?.edges?.[0]?.node;
if (!production) throw new Error("No Railway environment");

console.log(`[patch-vars] ${Object.keys(patch).join(", ")} → ${serviceId}`);
await upsertVariables(token, {
  projectId,
  environmentId: production.id,
  serviceId,
  variables: patch,
  skipDeploys: !shouldDeploy
});

if (shouldDeploy) {
  console.log("[patch-vars] triggering deploy…");
  await deployService(token, { serviceId, environmentId: production.id });
}

console.log("[patch-vars] done");
