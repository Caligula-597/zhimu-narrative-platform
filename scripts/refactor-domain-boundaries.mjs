import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function write(relative, source) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source.replace(/\r\n/g, "\n"));
}

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Missing split marker: ${start} -> ${end}`);
  return source.slice(from, to).trim();
}

function splitWorldHelpers() {
  const source = read("backend/src/routes/world-helpers.js");
  if (!source.includes("async function nextRoleSlotSequence")) return;
  const privateImports = source.slice(0, source.indexOf("async function nextRoleSlotSequence"));
  const importHelpers = between(
    source,
    "async function nextRoleSlotSequence",
    "/** Rooms visible to actor"
  );
  const access = between(
    source,
    "/** Rooms visible to actor",
    "export async function buildWorldSnapshot"
  );
  const chapters = between(
    source,
    "export async function buildWorldSnapshot",
    "export { creatorChecks }"
  );
  const story = between(
    source,
    "export function classifyStoryDraft",
    "export async function importDeepseekProposalWithClient"
  );
  const imports = source.slice(source.indexOf("export async function importDeepseekProposalWithClient")).trim();

  write("backend/src/routes/world-access-service.js", [
    'import { query } from "../db.js";',
    'import { throwErr } from "../api-errors.js";',
    access,
    ""
  ].join("\n"));

  write("backend/src/routes/world-chapter-service.js", [
    'import { pool, transaction } from "../db.js";',
    chapters,
    ""
  ].join("\n"));

  write("backend/src/routes/world-story-service.js", [
    'import { transaction } from "../db.js";',
    'import { throwErr } from "../api-errors.js";',
    story,
    ""
  ].join("\n"));

  write("backend/src/routes/world-import-service.js", [
    privateImports,
    importHelpers,
    imports,
    ""
  ].join("\n"));

  write("backend/src/routes/world-helpers.js", [
    "/** Backward-compatible world domain barrel. Prefer importing the focused service directly. */",
    'export * from "./world-access-service.js";',
    'export * from "./world-chapter-service.js";',
    'export * from "./world-story-service.js";',
    'export * from "./world-import-service.js";',
    'export { creatorChecks } from "../world-publish-readiness.js";',
    ""
  ].join("\n"));
}

function splitPlayerRoutes() {
  const source = read("backend/src/routes/player-routes.js");
  if (!source.includes("async function playerDisplayName")) return;
  const helperStart = source.indexOf("async function playerDisplayName");
  const registerStart = source.indexOf("export async function registerPlayerRoutes");
  if (helperStart < 0 || registerStart < 0) throw new Error("Player route markers missing");
  const imports = source.slice(0, helperStart).trim();
  const helper = source.slice(helperStart, registerStart).trim();
  const bodyStart = source.indexOf("{", registerStart) + 1;
  const body = source.slice(bodyStart, source.lastIndexOf("}"));
  const progressMarker = '  app.post("/api/rooms/game/submit"';
  const explorationMarker = '  app.get("/api/rooms/:roomId/exploration"';
  const progressAt = body.indexOf(progressMarker);
  const explorationAt = body.indexOf(explorationMarker);
  if (progressAt < 0 || explorationAt < 0) throw new Error("Player route group markers missing");

  const groups = [
    ["player-access-routes.js", "registerPlayerAccessRoutes", body.slice(0, progressAt)],
    ["player-progress-routes.js", "registerPlayerProgressRoutes", body.slice(progressAt, explorationAt)],
    ["player-exploration-routes.js", "registerPlayerExplorationRoutes", body.slice(explorationAt)]
  ];
  for (const [file, fn, group] of groups) {
    write(`backend/src/routes/${file}`, [
      imports,
      "",
      helper,
      "",
      `export async function ${fn}(app) {`,
      group.trimEnd(),
      "}",
      ""
    ].join("\n"));
  }
  write("backend/src/routes/player-routes.js", [
    'import { registerPlayerAccessRoutes } from "./player-access-routes.js";',
    'import { registerPlayerProgressRoutes } from "./player-progress-routes.js";',
    'import { registerPlayerExplorationRoutes } from "./player-exploration-routes.js";',
    "",
    "export async function registerPlayerRoutes(app) {",
    "  await registerPlayerAccessRoutes(app);",
    "  await registerPlayerProgressRoutes(app);",
    "  await registerPlayerExplorationRoutes(app);",
    "}",
    ""
  ].join("\n"));
}

function splitSchemas() {
  const source = read("backend/src/routes/schemas.js");
  if (!source.includes("export const roomIdParams")) return;
  const playerStart = source.indexOf("export const roomIdParams");
  const worldStart = source.indexOf("export const worldIdParams");
  if (playerStart < 0 || worldStart < 0) throw new Error("Schema split markers missing");
  const player = source.slice(playerStart, worldStart).trim();
  const remainder = source.slice(worldStart).trim();

  write("backend/src/routes/schemas/primitives.js", [
    'export const uuid = { type: "string", minLength: 36, maxLength: 36 };',
    'export const nonEmptyText = { type: "string", minLength: 1, maxLength: 1000 };',
    "",
    "export function paramsSchema(properties) {",
    "  return {",
    '    type: "object",',
    "    additionalProperties: false,",
    "    required: Object.keys(properties),",
    "    properties",
    "  };",
    "}",
    ""
  ].join("\n"));
  write("backend/src/routes/schemas/player.js", [
    'import { nonEmptyText, paramsSchema, uuid } from "./primitives.js";',
    "",
    player,
    ""
  ].join("\n"));
  write("backend/src/routes/schemas.js", [
    'import { nonEmptyText, paramsSchema, uuid } from "./schemas/primitives.js";',
    'import { checkpointIdParams, roleSlotRoomParams, roomIdParams, voiceRoomIdParams } from "./schemas/player.js";',
    'export { paramsSchema } from "./schemas/primitives.js";',
    'export * from "./schemas/player.js";',
    "",
    remainder,
    ""
  ].join("\n"));
}

function exportedNames(source) {
  return [...source.matchAll(/export (?:const|function) ([A-Za-z0-9_]+)/g)].map((match) => match[1]);
}

function importNames(names, specifier) {
  return names.length ? `import { ${names.join(", ")} } from "${specifier}";` : "";
}

function splitRemainingSchemaDomains() {
  const source = read("backend/src/routes/schemas.js");
  if (!source.includes("export const worldIdParams")) return;
  const worldStart = source.indexOf("export const worldIdParams");
  const creatorStart = source.indexOf("export const createWorldSchema");
  const aiStart = source.indexOf("const deepseekBriefBody");
  const platformStart = source.indexOf("const physicalTokenContentType");
  if ([worldStart, creatorStart, aiStart, platformStart].some((value) => value < 0)) {
    throw new Error("Remaining schema domain markers missing");
  }
  const world = source.slice(worldStart, creatorStart).trim();
  const creator = source.slice(creatorStart, aiStart).trim();
  const ai = source.slice(aiStart, platformStart).trim();
  const platform = source.slice(platformStart).trim();
  const playerNames = exportedNames(read("backend/src/routes/schemas/player.js"));
  const worldNames = exportedNames(world);
  const creatorNames = exportedNames(creator);
  const aiNames = exportedNames(ai);
  const primitiveImport = 'import { nonEmptyText, paramsSchema, uuid } from "./primitives.js";';

  write("backend/src/routes/schemas/world.js", [
    primitiveImport,
    importNames(playerNames, "./player.js"),
    "",
    world,
    ""
  ].join("\n"));
  write("backend/src/routes/schemas/creator.js", [
    primitiveImport,
    importNames(playerNames, "./player.js"),
    importNames(worldNames, "./world.js"),
    "",
    creator,
    ""
  ].join("\n"));
  write("backend/src/routes/schemas/ai.js", [
    primitiveImport,
    importNames(playerNames, "./player.js"),
    importNames(worldNames, "./world.js"),
    importNames(creatorNames, "./creator.js"),
    "",
    ai,
    ""
  ].join("\n"));
  write("backend/src/routes/schemas/platform.js", [
    primitiveImport,
    importNames(playerNames, "./player.js"),
    importNames(worldNames, "./world.js"),
    importNames(creatorNames, "./creator.js"),
    importNames(aiNames, "./ai.js"),
    "",
    platform,
    ""
  ].join("\n"));
  write("backend/src/routes/schemas.js", [
    "/** Backward-compatible schema barrel. New routes should import their domain schema module. */",
    'export { paramsSchema } from "./schemas/primitives.js";',
    'export * from "./schemas/player.js";',
    'export * from "./schemas/world.js";',
    'export * from "./schemas/creator.js";',
    'export * from "./schemas/ai.js";',
    'export * from "./schemas/platform.js";',
    ""
  ].join("\n"));
}

function repairAiSchemaBoundary() {
  const creatorPath = "backend/src/routes/schemas/creator.js";
  const aiPath = "backend/src/routes/schemas/ai.js";
  const creator = read(creatorPath);
  const marker = "const deepseekBriefBody";
  const markerAt = creator.indexOf(marker);
  if (markerAt < 0) return;
  const helpers = creator.slice(markerAt).trim();
  const ai = read(aiPath);
  const firstExport = ai.indexOf("export const deepseekPipelineSpecSchema");
  if (firstExport < 0) throw new Error("AI schema export marker missing");
  write(creatorPath, `${creator.slice(0, markerAt).trim()}\n`);
  write(aiPath, `${ai.slice(0, firstExport).trim()}\n\n${helpers}\n\n${ai.slice(firstExport).trim()}\n`);
}

function repairPlatformSchemaBoundary() {
  const aiPath = "backend/src/routes/schemas/ai.js";
  const platformPath = "backend/src/routes/schemas/platform.js";
  const ai = read(aiPath);
  const marker = "const physicalTokenContentType";
  const markerAt = ai.indexOf(marker);
  if (markerAt < 0) return;
  const helpers = ai.slice(markerAt).trim();
  const platform = read(platformPath);
  const firstExport = platform.indexOf("export const physicalTokenIdParams");
  if (firstExport < 0) throw new Error("Platform schema export marker missing");
  write(aiPath, `${ai.slice(0, markerAt).trim()}\n`);
  write(platformPath, `${platform.slice(0, firstExport).trim()}\n\n${helpers}\n\n${platform.slice(firstExport).trim()}\n`);
}

splitWorldHelpers();
splitPlayerRoutes();
splitSchemas();
splitRemainingSchemaDomains();
repairAiSchemaBoundary();
repairPlatformSchemaBoundary();
console.log("Domain boundary refactor complete");
