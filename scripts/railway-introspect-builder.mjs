#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { railwayGraphql } from "./railway-api.mjs";

const setupPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.railway.setup");
let token = process.env.RAILWAY_ACCOUNT_TOKEN || process.env.RAILWAY_TOKEN || "";
if (fs.existsSync(setupPath)) {
  for (const line of fs.readFileSync(setupPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if ((k === "RAILWAY_ACCOUNT_TOKEN" || k === "RAILWAY_TOKEN") && !token) token = v;
  }
}

const data = await railwayGraphql(
  token,
  `query {
    builder: __type(name: "Builder") { enumValues { name } }
    input: __type(name: "ServiceInstanceUpdateInput") {
      inputFields { name type { name kind ofType { name kind } } }
    }
  }`
);
console.log(JSON.stringify(data, null, 2));
