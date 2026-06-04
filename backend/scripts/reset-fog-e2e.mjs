#!/usr/bin/env node
/** @deprecated Use reset-e2e-room.mjs — kept as alias for older docs/scripts. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "reset-e2e-room.mjs");
const result = spawnSync(process.execPath, [script], { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
