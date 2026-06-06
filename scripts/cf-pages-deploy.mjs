#!/usr/bin/env node
/** @deprecated Use wrangler-pages-deploy-shim.mjs — kept as npm script alias. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const shim = path.join(path.dirname(fileURLToPath(import.meta.url)), "wrangler-pages-deploy-shim.mjs");
const r = spawnSync(process.execPath, [shim], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
