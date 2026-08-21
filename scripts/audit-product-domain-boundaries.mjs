#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTIVE_PRODUCT_TYPES, productDomainDefinition } from "../shared/product-domains/registry.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];

function requireMatch(file, pattern, message) {
  if (!pattern.test(read(file))) failures.push(`${file}: ${message}`);
}

function forbidMatch(file, pattern, message) {
  if (pattern.test(read(file))) failures.push(`${file}: ${message}`);
}

const domains = ACTIVE_PRODUCT_TYPES.map(productDomainDefinition);
for (let left = 0; left < domains.length; left += 1) {
  for (let right = left + 1; right < domains.length; right += 1) {
    const overlap = domains[left].toolViews.filter((view) => domains[right].toolViews.includes(view));
    if (overlap.length) failures.push(`${domains[left].key}/${domains[right].key}: shared business views ${overlap.join(", ")}`);
  }
}

const expectedHomes = { murder_mystery: "creatorCockpit", tabletop_rpg: "tabletopMap", board_game: "boardGame" };
for (const [product, home] of Object.entries(expectedHomes)) {
  if (productDomainDefinition(product).homeView !== home) failures.push(`${product}: home must be ${home}`);
}

for (const retired of [
  "backend/src/world-templates.js",
  "backend/src/world-wizard-bootstrap.js",
  "backend/src/routes/world-wizard-routes.js"
]) {
  if (exists(retired)) failures.push(`${retired}: cross-product bootstrap content must stay deleted`);
}

requireMatch("src/runtime/view-loader.js", /PRODUCT_VIEW_MODULES/u, "must load the parallel product registry");
forbidMatch("src/runtime/view-loader.js", /import\("\.\.\/views\/(?:writer|tabletop-map|board-game)\.js"\)/u, "business views must not return to the shared loader");
forbidMatch("src/runtime/studio-loader.js", /"(?:tabletopMap|boardGame)"/u, "non-murder products must not load the murder Studio snapshot");
for (const product of ["murder-mystery", "tabletop-rpg", "board-game"]) {
  requireMatch(`src/products/${product}/product-module.js`, /viewModules:[\s\S]*shell:[\s\S]*library:[\s\S]*runtime:/u, "product module must own views, shell, library and runtime contracts");
}
for (const file of ["src/runtime/nav-shell.js", "src/runtime/auth-world.js", "src/bootstrap/events.js", "src/runtime/view-loader.js"]) {
  forbidMatch(file, /murder_mystery|tabletop_rpg|board_game|murder-mystery|tabletop-rpg|board-game/u, "shared frontend orchestrators must not branch on concrete products");
}

forbidMatch("src/views/writer-document-workspace.js", /data-document-field="creationType"|tabletop_rpg|board_game/u, "document import must be fixed to the murder-mystery domain");
forbidMatch("src/views/settings.js", /id="settings-creation-type"/u, "project type must remain immutable");
forbidMatch("src/views/board-game.js", /studioStore|zhimuApi\.(?:createRole|updateRole|deleteRole)/u, "board-game seats must stay in boardGameDesign.seats");
requireMatch("src/views/board-game.js", /products\/board-game\/api\.js/u, "board-game AI calls must stay in the board-game module");
forbidMatch("src/api/ai.js", /board.game|board_game|桌游/iu, "shared murder-mystery AI client must not contain board-game endpoints");
forbidMatch("src/views/tabletop-map.js", /studioStore|当前剧本|保存到当前剧本/u, "tabletop workspace must not depend on murder Studio or terminology");
for (const file of ["src/views/clues-editor.js", "src/views/clues-crud-controller.js"]) {
  forbidMatch(file, /tabletopMapDesign/u, "murder clues must not read tabletop locations");
}
forbidMatch("src/views/clue-flow-view.js", /locationId|location_id/u, "murder clue readiness must not accept tabletop location bindings");
for (const file of [
  "backend/src/studio-scene-clue-service.js",
  "backend/src/repositories/studio-scene-clue-repository.js",
  "backend/src/routes/schemas/studio-scene-clue.js"
]) {
  forbidMatch(file, /tabletopMapDesign/u, "murder clue services must not read tabletop content");
}
forbidMatch("backend/src/routes/schemas/studio-scene-clue.js", /locationId/u, "murder clue path contracts must not expose tabletop locations");
forbidMatch("backend/src/repositories/item-action-repository.js", /tabletopMapDesign/u, "murder item actions must not target tabletop map content");
for (const file of [
  "backend/src/studio-item-service.js",
  "backend/src/routes/schemas/studio-item.js",
  "backend/src/routes/schemas/item-action.js",
  "src/views/studio-create-editor.js",
  "src/views/studio.js"
]) {
  forbidMatch(file, /targetType[^\n]*location|id:\s*"location"/u, "murder item contracts must not expose tabletop location targets");
}
requireMatch("src/products/tabletop-rpg/product-module.js", /activate\(\{ go \}\)[\s\S]*?go\(TABLETOP_RPG_DOMAIN\.homeView\)/u, "tabletop run action must stay inside its own module");
requireMatch("scripts/browser-fixture-api.mjs", /fixtureCreationType === "tabletop_rpg" \? \{[\s\S]*?tabletopMapDesign[\s\S]*?\} : fixtureCreationType === "board_game" \? \{/u, "browser fixtures must keep product settings isolated");
forbidMatch("src/views/writer.js", /board_game|tabletop_rpg|桌游|跑团/u, "murder writer contains another product's content");
forbidMatch("src/views/archive.js", /跑团/u, "murder archive contains tabletop copy");
forbidMatch("src/views/settings.js", /跑团|桌游/u, "murder settings contains another product's content");
forbidMatch("src/views/mini-games.js", /const settings = \{ \.\.\.\(world\.settings/u, "murder tools must patch only their owned settings namespace");

requireMatch("backend/src/routes.js", /registerMurderMysteryProductRoutes/u, "murder routes must be registered as an isolated plugin");
requireMatch("backend/src/routes.js", /registerTabletopRpgProductRoutes/u, "tabletop routes must have an isolated plugin boundary");
requireMatch("backend/src/routes.js", /registerBoardGameProductRoutes/u, "board-game routes must be registered as an isolated plugin");
requireMatch("backend/src/routes/products/murder-mystery-routes.js", /createWorldProductPreHandler\("murder_mystery"\)/u, "murder routes need a product guard");
requireMatch("backend/src/routes/products/tabletop-rpg-routes.js", /createWorldProductPreHandler\("tabletop_rpg"\)/u, "tabletop routes need a product guard");
requireMatch("backend/src/routes/products/board-game-routes.js", /createWorldProductPreHandler\("board_game"\)/u, "board-game routes need a product guard");
forbidMatch("backend/src/routes/story-assistant-routes.js", /board.game|board_game|桌游/iu, "murder assistant routes must not contain board-game endpoints");
requireMatch("backend/src/world-service.js", /WORLD_PRODUCT_IMMUTABLE/u, "backend must reject product conversion");
requireMatch("backend/src/world-service.js", /assertProductSettingsBoundary/u, "backend must reject foreign product settings");
requireMatch("backend/src/repositories/world-repository.js", /AS creation_type/u, "world lists must expose a product discriminator without leaking settings");
requireMatch("backend/src/repositories/world-repository.js", /creationType'[\s\S]*?= 'murder_mystery'/u, "the current public runtime catalog must remain murder-mystery only");
requireMatch("backend/src/repositories/world-repository.js", /worldMode'[\s\S]*?tabletop_rpg[\s\S]*?= 'murder_mystery'/u, "legacy tabletop projects must stay out of the murder-mystery catalog");
requireMatch("backend/src/platform-catalog-preview.js", /worldMode'[\s\S]*?tabletop_rpg[\s\S]*?= 'murder_mystery'/u, "marketing previews must keep legacy tabletop projects out of the murder-mystery catalog");
for (const file of ["app.js", "src/runtime/nav-shell.js"]) {
  requireMatch(file, /narrativeProfileFromWorld/u, "shell routing must understand lightweight world-list rows");
}
requireMatch("src/runtime/auth-world.js", /productModuleForWorld/u, "project library must resolve ownership through product modules");
for (const file of ["backend/src/catalog-join-service.js", "backend/src/catalog-review.js", "backend/src/catalog-review-ops.js"]) {
  requireMatch(file, /WORLD_PRODUCT_MISMATCH/u, "murder-mystery catalog operations must reject other products");
}

if (failures.length) {
  console.error("Product domain boundary violations:");
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log(`product domain boundaries passed: ${domains.map((domain) => `${domain.label}=${domain.toolViews.join("/")}`).join("; ")}`);
