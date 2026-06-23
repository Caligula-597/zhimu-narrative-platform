#!/usr/bin/env node
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

const serviceId = process.env.RAILWAY_SERVICE_ID || "fc78dfb7-98dc-4ca5-8a9e-4cb9a9db80b1";
const token = loadToken();

const data = await railwayGraphql(
  token,
  `query($serviceId: String!, $first: Int!) {
    deployments(input: { serviceId: $serviceId }, first: $first) {
      edges {
        node {
          id
          status
          createdAt
          meta
          staticUrl
        }
      }
    }
  }`,
  { serviceId, first: 5 }
);

console.log(JSON.stringify(data, null, 2));

for (const edge of data.deployments?.edges ?? []) {
  const id = edge.node.id;
  try {
    const logs = await railwayGraphql(
      token,
      `query($deploymentId: String!) {
        deploymentLogs(deploymentId: $deploymentId) {
          message
          timestamp
        }
      }`,
      { deploymentId: id }
    );
    console.log(`\n--- LOGS ${id} (${edge.node.status}) ---`);
    const lines = logs.deploymentLogs ?? [];
    for (const line of lines.slice(-40)) {
      console.log(line.message || line);
    }
  } catch (error) {
    console.log(`\n--- LOGS ${id}: ${error.message} ---`);
  }
}
