#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routesDir = path.join(root, "backend/src/routes");
const routeFiles = fs.readdirSync(routesDir)
  .filter((name) => name.endsWith("-routes.js"))
  .sort();

const ZERO_DB_ROUTES = new Set([
  "player-exploration-routes.js",
  "story-assistant-routes.js",
  "world-routes.js"
]);
const MAX_ROUTE_LINES = 400;
const MAX_DIRECT_DB_POINTS_PER_ROUTE = 20;
const MAX_DIRECT_DB_POINTS_TOTAL = 185;

const rows = routeFiles.map((file) => {
  const source = fs.readFileSync(path.join(routesDir, file), "utf8");
  const lines = source.split(/\r?\n/).length;
  const dbImports = (source.match(/from\s+["']\.\.\/db\.js["']/g) || []).length;
  const queryCalls = (source.match(/(?:\bquery|client\.query)\s*\(/g) || []).length;
  return { file, lines, dbImports, queryCalls };
});

const failures = [];
for (const row of rows) {
  if (row.lines > MAX_ROUTE_LINES) {
    failures.push(`${row.file}: ${row.lines} lines exceeds route budget ${MAX_ROUTE_LINES}`);
  }
  if (row.queryCalls > MAX_DIRECT_DB_POINTS_PER_ROUTE) {
    failures.push(`${row.file}: ${row.queryCalls} direct DB points exceeds budget ${MAX_DIRECT_DB_POINTS_PER_ROUTE}`);
  }
  if (ZERO_DB_ROUTES.has(row.file) && (row.dbImports || row.queryCalls)) {
    failures.push(`${row.file}: migrated route must remain repository/service-only`);
  }
}

const totalDirectDbPoints = rows.reduce((sum, row) => sum + row.queryCalls, 0);
if (totalDirectDbPoints > MAX_DIRECT_DB_POINTS_TOTAL) {
  failures.push(`route direct DB total ${totalDirectDbPoints} exceeds ratchet ${MAX_DIRECT_DB_POINTS_TOTAL}`);
}

for (const relative of [
  "backend/src/routes/world-helpers.js",
  "backend/src/routes/schemas.js",
  "backend/src/routes/player-routes.js"
]) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const lines = source.split(/\r?\n/).length;
  if (lines > 80) failures.push(`${relative}: compatibility barrel grew to ${lines} lines`);
}

const hotspots = rows
  .filter((row) => row.queryCalls)
  .sort((a, b) => b.queryCalls - a.queryCalls || b.lines - a.lines)
  .slice(0, 12);
console.log(`domain boundary audit: ${routeFiles.length} route modules, ${totalDirectDbPoints} direct DB points`);
console.log("Remaining direct-DB hotspots (ratcheted debt):");
for (const row of hotspots) {
  console.log(`  ${String(row.queryCalls).padStart(2)} DB\t${String(row.lines).padStart(3)} lines\t${row.file}`);
}
console.log("Migrated repository/service routes: player-exploration, story-assistant, world");

if (failures.length) {
  console.error("\nDomain boundary violations:");
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}
console.log(`domain boundary budgets passed (total ratchet <= ${MAX_DIRECT_DB_POINTS_TOTAL})`);
