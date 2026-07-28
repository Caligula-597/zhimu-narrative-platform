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
  ["host-content-action-routes.js", 'app.post("/api/rooms/:roomId/host/grant-clue", { schema:'],
  ["host-event-routes.js", 'app.post("/api/rooms/:roomId/host-events/batch", { schema:'],
  ["host-event-routes.js", 'app.post("/api/rooms/:roomId/host-events/:eventId/delay", { schema:'],
  ["player-access-routes.js", 'app.post("/api/rooms/join", { schema:'],
  ["player-exploration-routes.js", 'app.post("/api/rooms/:roomId/clues/:clueId/share-roles", { schema:'],
  ["player-progress-routes.js", 'app.post("/api/rooms/:roomId/sections/:sectionId/complete", { schema:'],
  ["auth-session-routes.js", 'app.post("/api/auth/login", { schema:'],
  ["auth-recovery-routes.js", 'app.post("/api/auth/forgot-password", { schema:'],
  ["auth-recovery-routes.js", 'app.post("/api/auth/reset-password", { schema:'],
  ["auth-recovery-routes.js", 'app.post("/api/auth/verify-email", { schema:'],
  ["account-routes.js", 'app.post("/api/account/plan-upgrade-request", {'],
  ["voice-routes.js", 'app.post("/api/rooms/:roomId/voice-rooms", { schema:'],
  ["recap-routes.js", 'app.post("/api/rooms/:roomId/recaps", { schema:'],
  ["room-events-routes.js", 'app.get("/api/rooms/:roomId/events/stream", { schema:'],
  // Studio (phase 2)
  ["studio-scene-clue-routes.js", 'app.post("/api/worlds/:worldId/scenes", { schema:'],
  ["studio-scene-clue-routes.js", 'app.patch("/api/worlds/:worldId/scenes/:sceneId", { schema:'],
  ["studio-scene-clue-routes.js", 'app.post("/api/worlds/:worldId/clues", { schema:'],
  ["studio-scene-clue-routes.js", 'app.patch("/api/worlds/:worldId/clues/:clueId", { schema:'],
  ["studio-investigation-routes.js", 'app.patch("/api/worlds/:worldId/investigation-points/:pointId", { schema:'],
  ["studio-investigation-routes.js", 'app.post("/api/worlds/:worldId/scenes/:sceneId/investigation-points", { schema:'],
  ["studio-item-routes.js", 'app.post("/api/worlds/:worldId/items", { schema:'],
  ["studio-item-routes.js", 'app.patch("/api/worlds/:worldId/items/:itemId", { schema:'],
  ["studio-story-edge-routes.js", 'app.post("/api/worlds/:worldId/story-edges", { schema:'],
  ["studio-graph-routes.js", 'app.put("/api/worlds/:worldId/story-layout", { schema:'],
  ["studio-graph-routes.js", 'app.delete("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId", { schema:'],
  // Creator (phase 2)
  ["creator-role-routes.js", 'app.post("/api/worlds/:worldId/roles", { schema:'],
  ["creator-chapter-routes.js", 'app.post("/api/worlds/:worldId/chapters", { schema:'],
  ["creator-section-routes.js", 'app.post("/api/worlds/:worldId/roles/:roleSlotId/sections", { schema:'],
  ["creator-room-routes.js", 'app.post("/api/worlds/:worldId/rooms", { schema:'],
  ["creator-document-routes.js", 'app.post("/api/worlds/:worldId/documents/import-pages", { schema:'],
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
  ["story-manuscript-routes.js", 'app.put("/api/worlds/:worldId/story-manuscript", { schema:'],
  ["story-manuscript-routes.js", 'app.post("/api/worlds/:worldId/story-manuscript/sync-to-graph", { schema:'],
  ["story-assistant-routes.js", 'app.post("/api/worlds/:worldId/story-assistant/import", { schema:'],
  ["search-routes.js", 'app.get("/api/worlds/:worldId/search", { schema:']
];

/** Creator writes consumed through frontend worldWrite must stay revision-aware. */
const REQUIRED_REVISION_ROUTES = [
  ["batch-b-routes.js", 'app.put("/api/worlds/:worldId/tags"'],
  ["batch-b-routes.js", 'app.post("/api/worlds/:worldId/segment-remedies"'],
  ["batch-b-routes.js", 'app.patch("/api/worlds/:worldId/segment-remedies/:remedyId"'],
  ["batch-b-routes.js", 'app.delete("/api/worlds/:worldId/segment-remedies/:remedyId"'],
  ["physical-token-routes.js", 'app.post("/api/worlds/:worldId/physical-tokens"'],
  ["physical-token-routes.js", 'app.post("/api/worlds/:worldId/physical-tokens/:tokenId/revoke"']
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

function hasRequiredSchemaRegistration(content, marker) {
  if (content.includes(marker)) return true;
  const route = marker.match(/app\.(get|post|put|patch|delete)\("([^"]+)"/);
  if (!route) return false;
  const [, method, routePath] = route;
  const lines = content.split("\n");
  const startIndex = lines.findIndex((line) => line.includes(`app.${method}("${routePath}"`));
  if (startIndex < 0) return false;
  return /\bschema\s*:/.test(collectRegistrationBlock(lines, startIndex).block);
}

let failed = false;
for (const [file, marker] of REQUIRED_SCHEMA_MARKERS) {
  const content = readFileSync(join(routesDir, file), "utf8");
  if (!hasRequiredSchemaRegistration(content, marker)) {
    console.error(`FAIL  ${file}  missing schema marker: ${marker}`);
    failed = true;
  } else {
    console.log(`OK    ${file}  ${marker.split('"')[1]}`);
  }
}

for (const [file, marker] of REQUIRED_REVISION_ROUTES) {
  const content = readFileSync(join(routesDir, file), "utf8");
  const start = content.indexOf(marker);
  const nextRoute = start < 0 ? -1 : content.indexOf("\n  app.", start + marker.length);
  const routeBlock = start < 0 ? "" : content.slice(start, nextRoute < 0 ? content.length : nextRoute);
  if (!routeBlock.includes("runRevisionMutation")) {
    console.error(`FAIL  ${file}  missing revision mutation wrapper: ${marker}`);
    failed = true;
  } else {
    console.log(`REV   ${file}  ${marker.split('"')[1]}`);
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

console.log(`\nverify-route-schemas: ${REQUIRED_SCHEMA_MARKERS.length} schema markers + ${REQUIRED_REVISION_ROUTES.length} revision markers + dynamic scan OK`);
