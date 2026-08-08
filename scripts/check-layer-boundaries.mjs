/**
 * Enforce backend route layer boundaries — routes should delegate to *-service / domain modules.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const routesDir = path.join(import.meta.dirname, "../backend/src/routes");
const routeAggregators = new Set([
  "player-routes.js",
  "ops-routes.js",
  "account-routes.js",
  "content-platform-routes.js",
  "auth-routes.js",
  "host-routes.js",
  "creator-routes.js",
  "studio-routes.js",
  "story-assistant-routes.js"
]);
const allowedRouteImports = [
  /^\.\/schemas\.js$/,
  /^\.\/schemas\//,
  /^\.\/route-guards\.js$/,
  /^\.\/[\w-]+-(helpers|service|hook|actions|access|shared|guards)\.js$/,
  /^\.\/content-package-helpers\.js$/,
  /^\.\/world-helpers\.js$/,
  /^\.\.\/[\w-]+\.js$/
];

function listRouteFiles() {
  return fs.readdirSync(routesDir)
    .filter((file) => file.endsWith("-routes.js"))
    .map((file) => path.join(routesDir, file));
}

function parseImports(source) {
  const imports = [];
  for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
    imports.push(match[1]);
  }
  return imports;
}

test("route files do not import sibling route modules directly", () => {
  const violations = [];
  for (const file of listRouteFiles()) {
    const base = path.basename(file);
    const source = fs.readFileSync(file, "utf8");
    for (const imp of parseImports(source)) {
      if (!imp.startsWith("./")) continue;
      if (imp.endsWith("-routes.js") && imp !== `./${base}`) {
        if (routeAggregators.has(base)) continue;
        violations.push(`${base} -> ${imp}`);
        continue;
      }
      if (imp.endsWith("-routes.js")) continue;
      if (allowedRouteImports.some((re) => re.test(imp))) continue;
      if (imp.startsWith("./schemas")) continue;
      violations.push(`${base} -> ${imp}`);
    }
  }
  assert.deepEqual(violations, [], `Unexpected route imports:\n${violations.join("\n")}`);
});
