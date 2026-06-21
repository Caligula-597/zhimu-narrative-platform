/**
 * Ensures write routes declare Fastify JSON schemas.
 * Phase 1: curated markers (regression guard).
 * Phase 2: dynamic scan of *-routes.js for POST/PUT/PATCH/DELETE without schema.
 * See docs/BACKEND_OPS.md and docs/BACKEND_OPS_BENCHMARK.md.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const routesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "routes");

/** [file, route registration snippet that must appear] */
const REQUIRED_SCHEMA_MARKERS = [
  // Runtime / assets / auth (phase 1)
  ["asset-routes.js", 'app.post("/api/assets/upload-url", { schema:'],
  ["asset-routes.js", 'app.post("/api/assets/:assetId/confirm", { schema:'],
  ["asset-routes.js", 'app.delete("/api/assets/:assetId", { schema:'],
  ["asset-routes.js", 'app.post("/api/assets/:assetId/restore", { schema:'],
  ["world-routes.js", 'app.post("/api/worlds", { schema:'],
  ["world-routes.js", 'app.patch("/api/worlds/:worldId", { schema:'],
  ["world-routes.js", 'app.delete("/api/worlds/:worldId", { schema:'],
  ["world-routes.js", 'app.post("/api/worlds/:worldId/members", { schema:'],
  ["world-routes.js", 'app.put("/api/worlds/:worldId/members/:userId", { schema:'],
  ["world-routes.js", 'app.delete("/api/worlds/:worldId/members/:userId", { schema:'],
  ["checkpoint-routes.js", 'app.post("/api/rooms/:roomId/checkpoints", { schema:'],
  ["checkpoint-routes.js", 'app.post("/api/rooms/:roomId/checkpoints/:checkpointId/restore", { schema:'],
  ["host-routes.js", 'app.post("/api/rooms/:roomId/host/grant-clue", { schema:'],
  ["host-routes.js", 'app.post("/api/rooms/:roomId/host-events/batch", { schema:'],
  ["host-routes.js", 'app.post("/api/rooms/:roomId/host-events/:eventId/delay", { schema:'],
  ["player-routes.js", 'app.post("/api/rooms/join", { schema:'],
  ["player-routes.js", 'app.post("/api/rooms/:roomId/clues/:clueId/share-roles", { schema:'],
  ["player-routes.js", 'app.post("/api/rooms/:roomId/sections/:sectionId/complete", { schema:'],
  ["auth-routes.js", 'app.post("/api/auth/login", { schema:'],
  ["auth-routes.js", 'app.post("/api/auth/forgot-password", { schema:'],
  ["auth-routes.js", 'app.post("/api/auth/reset-password", { schema:'],
  ["auth-routes.js", 'app.post("/api/auth/verify-email", { schema:'],
  ["account-routes.js", 'app.post("/api/account/plan-upgrade-request", {'],
  ["voice-routes.js", 'app.post("/api/rooms/:roomId/voice-rooms", { schema:'],
  ["recap-routes.js", 'app.post("/api/rooms/:roomId/recaps", { schema:'],
  ["room-events-routes.js", 'app.get("/api/rooms/:roomId/events/stream", { schema:'],
  // Studio (phase 2)
  ["studio-routes.js", 'app.post("/api/worlds/:worldId/scenes", { schema:'],
  ["studio-routes.js", 'app.patch("/api/worlds/:worldId/scenes/:sceneId", { schema:'],
  ["studio-routes.js", 'app.post("/api/worlds/:worldId/clues", { schema:'],
  ["studio-routes.js", 'app.patch("/api/worlds/:worldId/clues/:clueId", { schema:'],
  ["studio-routes.js", 'app.patch("/api/worlds/:worldId/investigation-points/:pointId", { schema:'],
  ["studio-routes.js", 'app.post("/api/worlds/:worldId/scenes/:sceneId/investigation-points", { schema:'],
  ["studio-routes.js", 'app.post("/api/worlds/:worldId/items", { schema:'],
  ["studio-routes.js", 'app.patch("/api/worlds/:worldId/items/:itemId", { schema:'],
  ["studio-routes.js", 'app.post("/api/worlds/:worldId/story-edges", { schema:'],
  ["studio-graph-routes.js", 'app.put("/api/worlds/:worldId/story-layout", { schema:'],
  ["studio-graph-routes.js", 'app.delete("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId", { schema:'],
  // Creator (phase 2)
  ["creator-routes.js", 'app.post("/api/worlds/:worldId/roles", { schema:'],
  ["creator-routes.js", 'app.post("/api/worlds/:worldId/chapters", { schema:'],
  ["creator-routes.js", 'app.post("/api/worlds/:worldId/roles/:roleSlotId/sections", { schema:'],
  ["creator-routes.js", 'app.post("/api/worlds/:worldId/rooms", { schema:'],
  ["creator-routes.js", 'app.post("/api/worlds/:worldId/documents/import-pages", { schema:'],
  ["script-bundle-routes.js", 'app.post("/api/worlds/:worldId/script-bundle/analyze", { schema:'],
  ["script-bundle-routes.js", 'app.post("/api/worlds/:worldId/script-bundle/import", { schema:'],
  ["script-bundle-routes.js", 'app.post("/api/worlds/from-script-bundle", { schema:'],
  // Rules + content package (phase 2)
  ["rules-routes.js", 'app.post("/api/worlds/:worldId/rules", { schema:'],
  ["rules-routes.js", 'app.put("/api/worlds/:worldId/rules/:ruleId", { schema:'],
  ["rules-routes.js", 'app.post("/api/worlds/:worldId/rules/validate-body", { schema:'],
  ["content-package-routes.js", 'app.post("/api/worlds/:worldId/content-package/import", { schema:'],
  ["content-package-routes.js", 'app.post("/api/worlds/from-content-package", { schema:'],
  // Story assistant (P0)
  ["story-assistant-routes.js", 'app.post("/api/worlds/:worldId/story-assistant/analyze", { schema:'],
  ["story-assistant-routes.js", 'app.post("/api/worlds/:worldId/story-assistant/deepseek/propose", { schema:'],
  ["story-assistant-routes.js", 'app.post("/api/worlds/:worldId/story-assistant/deepseek/import", { schema:'],
  ["story-assistant-routes.js", 'app.post("/api/worlds/:worldId/story-assistant/deepseek/full-mystery/propose", { schema:'],
  ["story-assistant-routes.js", 'app.post("/api/worlds/:worldId/story-assistant/deepseek/full-mystery/import", { schema:'],
  ["story-assistant-routes.js", 'app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/spec", { schema:'],
  ["story-assistant-routes.js", 'app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/import", { schema:'],
  ["story-assistant-routes.js", 'app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/evaluate", { schema:'],
  ["story-assistant-routes.js", 'app.put("/api/worlds/:worldId/story-manuscript", { schema:'],
  ["story-assistant-routes.js", 'app.post("/api/worlds/:worldId/story-manuscript/sync-to-graph", { schema:'],
  ["story-assistant-routes.js", 'app.post("/api/worlds/:worldId/story-assistant/import", { schema:'],
  ["search-routes.js", 'app.get("/api/worlds/:worldId/search", { schema:']
];

/** Dynamic scan allowlist: [file, method, path] */
const DYNAMIC_SCHEMA_ALLOWLIST = new Set([
  // Fastify plugin hooks or non-JSON handlers registered in route files
]);

function collectRegistrationBlock(lines, startIndex) {
  let block = lines[startIndex];
  let index = startIndex;
  while (index + 1 < lines.length && !/,\s*async\s*\(/.test(block) && index - startIndex < 14) {
    index += 1;
    block += `\n${lines[index]}`;
  }
  return { block, endIndex: index };
}

function findUnschemaedWriteRoutes(content, file) {
  const issues = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/app\.(post|put|patch|delete)\(/.test(line)) continue;
    const methodMatch = line.match(/app\.(post|put|patch|delete)\(/);
    if (!methodMatch) continue;
    const method = methodMatch[1];
    const { block } = collectRegistrationBlock(lines, i);
    if (/\bschema\s*:/.test(block)) continue;
    const pathMatch = block.match(/app\.\w+\(\s*("([^"]+)"|'([^']+)')/);
    const routePath = pathMatch?.[2] || pathMatch?.[3] || "?";
    const key = `${file}|${method.toUpperCase()}|${routePath}`;
    if (DYNAMIC_SCHEMA_ALLOWLIST.has(key)) continue;
    issues.push({ file, line: i + 1, method: method.toUpperCase(), path: routePath });
  }
  return issues;
}

let failed = false;
for (const [file, marker] of REQUIRED_SCHEMA_MARKERS) {
  const content = readFileSync(join(routesDir, file), "utf8");
  if (!content.includes(marker)) {
    console.error(`FAIL  ${file}  missing schema marker: ${marker}`);
    failed = true;
  } else {
    console.log(`OK    ${file}  ${marker.split('"')[1]}`);
  }
}

const routeFiles = readdirSync(routesDir).filter((name) => name.endsWith("-routes.js"));
const dynamicIssues = [];
for (const file of routeFiles) {
  const content = readFileSync(join(routesDir, file), "utf8");
  dynamicIssues.push(...findUnschemaedWriteRoutes(content, file));
}

if (dynamicIssues.length) {
  failed = true;
  console.error("\nDynamic scan: write routes missing { schema: ... }:");
  for (const issue of dynamicIssues) {
    console.error(`  FAIL  ${issue.file}:${issue.line}  ${issue.method} ${issue.path}`);
  }
} else {
  console.log(`\nDynamic scan: ${routeFiles.length} route files, 0 unschemaed write routes`);
}

if (failed) {
  process.exit(1);
}

console.log(`\nverify-route-schemas: ${REQUIRED_SCHEMA_MARKERS.length} markers + dynamic scan OK`);
