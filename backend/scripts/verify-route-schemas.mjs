/**
 * Ensures write routes declare Fastify JSON schemas.
 * See docs/BACKEND_OPS.md and docs/BACKEND_OPS_BENCHMARK.md.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const routesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "routes");

/** [file, route registration snippet that must appear] */
const REQUIRED_SCHEMA_MARKERS = [
  // Runtime / assets / auth (phase 1)
  ["asset-routes.js", 'app.post("/api/assets/upload-url", { schema:'],
  ["asset-routes.js", 'app.post("/api/assets/:assetId/confirm", { schema:'],
  ["asset-routes.js", 'app.delete("/api/assets/:assetId", { schema:'],
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
  ["player-routes.js", 'app.post("/api/rooms/join", { schema:'],
  ["player-routes.js", 'app.post("/api/rooms/:roomId/sections/:sectionId/complete", { schema:'],
  ["auth-routes.js", 'app.post("/api/auth/login", { schema:'],
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

if (failed) {
  process.exit(1);
}

console.log(`\nverify-route-schemas: ${REQUIRED_SCHEMA_MARKERS.length} routes OK`);
