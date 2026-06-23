#!/usr/bin/env node
/** Print build + runtime logs for a Railway deployment (latest failed by default). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { railwayGraphql } from "./railway-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = path.join(root, ".env.railway.setup");

function loadToken() {
  let token = process.env.RAILWAY_ACCOUNT_TOKEN || process.env.RAILWAY_TOKEN || "";
  if (!fs.existsSync(setupPath)) return token;
  for (const line of fs.readFileSync(setupPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if ((k === "RAILWAY_ACCOUNT_TOKEN" || k === "RAILWAY_TOKEN") && !token) token = v;
  }
  return token;
}

const deploymentId = process.argv[2];
const token = loadToken();
const sid = process.env.RAILWAY_SERVICE_ID || "fc78dfb7-98dc-4ca5-8a9e-4cb9a9db80b1";

async function pickDeploymentId() {
  if (deploymentId) return deploymentId;
  const data = await railwayGraphql(
    token,
    `query($serviceId: String!, $first: Int!) {
      deployments(input: { serviceId: $serviceId }, first: $first) {
        edges { node { id status createdAt } }
      }
    }`,
    { serviceId: sid, first: 8 }
  );
  const failed = (data.deployments?.edges ?? []).find((e) => e.node.status === "FAILED");
  const latest = data.deployments?.edges?.[0]?.node;
  return failed?.node?.id ?? latest?.id;
}

async function printLogs(label, query, variables) {
  try {
    const data = await railwayGraphql(token, query, variables);
    const key = Object.keys(data)[0];
    const lines = data[key] ?? [];
    console.log(`\n=== ${label} (${lines.length} lines) ===`);
    for (const line of lines.slice(-80)) {
      const msg = line.message ?? line.text ?? JSON.stringify(line);
      console.log(msg);
    }
  } catch (error) {
    console.log(`\n=== ${label}: ${error.message} ===`);
  }
}

const id = await pickDeploymentId();
if (!id) {
  console.error("No deployment found");
  process.exit(1);
}
console.log(`Deployment: ${id}`);

const detail = await railwayGraphql(
  token,
  `query($id: String!) { deployment(id: $id) { id status createdAt meta } }`,
  { id }
);
console.log(JSON.stringify(detail.deployment, null, 2));

await printLogs(
  "buildLogs",
  `query($deploymentId: String!, $limit: Int) {
    buildLogs(deploymentId: $deploymentId, limit: $limit) { timestamp message }
  }`,
  { deploymentId: id, limit: 200 }
);

await printLogs(
  "deploymentLogs",
  `query($deploymentId: String!, $limit: Int) {
    deploymentLogs(deploymentId: $deploymentId, limit: $limit) { timestamp message }
  }`,
  { deploymentId: id, limit: 120 }
);
