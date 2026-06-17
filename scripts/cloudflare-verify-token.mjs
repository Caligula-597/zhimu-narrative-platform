#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const setupPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.railway.setup");
const lines = fs.readFileSync(setupPath, "utf8").split(/\r?\n/);
const token = lines
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .find((l) => l.startsWith("CLOUDFLARE_API_TOKEN="))
  ?.slice("CLOUDFLARE_API_TOKEN=".length)
  .trim();

if (!token) {
  console.log("status=missing");
  process.exit(1);
}

console.log(`status=present len=${token.length} prefix=${token.slice(0, 5)}`);

const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
  headers: { Authorization: `Bearer ${token}` }
});
const body = await res.json();
console.log(`http=${res.status} success=${body.success}`);
if (body.errors?.length) {
  console.log(`error=${body.errors.map((e) => e.message).join("; ")}`);
}
if (body.result?.status) {
  console.log(`token_status=${body.result.status}`);
}
