#!/usr/bin/env node
/**
 * Boot smoke — runs full startup validation (env + module graph + DB schema).
 * Requires reachable Postgres (same as npm test).
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(here, "..");

if (!process.env.DATABASE_URL) {
  console.error("verify-boot: DATABASE_URL required (Postgres must be reachable)");
  process.exit(1);
}

const { runStartupValidation } = await import(
  pathToFileURL(path.join(backendRoot, "src", "startup-validation.js")).href
);
await runStartupValidation();
console.log("verify-boot: OK (env + module graph + database schema)");
