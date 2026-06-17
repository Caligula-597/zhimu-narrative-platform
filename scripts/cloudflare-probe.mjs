#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getZoneByName, verifyToken } from "./cloudflare-api.mjs";
import { cfRequest } from "./cloudflare-api.mjs";

const setupPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.railway.setup");
function loadToken() {
  for (const line of fs.readFileSync(setupPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith("CLOUDFLARE_API_TOKEN=")) return t.slice(21).trim();
  }
  return "";
}

const token = loadToken();
await verifyToken(token);
try {
  const zone = await getZoneByName(token, "getzhimu.com");
  console.log("zone", zone ? zone.name : "NOT_FOUND");
} catch (e) {
  console.log("zone_error", e.message);
}
try {
  const accounts = await cfRequest(token, "/accounts");
  console.log("accounts", accounts.length, accounts.map((a) => a.name).join(", "));
} catch (e) {
  console.log("accounts_error", e.message);
}
