import { LEGACY_INTERACTIVE_STORY_DOMAIN } from "../../shared/product-domains/legacy-interactive-story.js";
import { normalizeProductDomainType } from "../../shared/product-domains/registry.js";
import { narrativeProfileFromWorld } from "../../shared/narrative-profile.js";
import { BOARD_GAME_PRODUCT_MODULE } from "./board-game/product-module.js";
import { MURDER_MYSTERY_PRODUCT_MODULE } from "./murder-mystery/product-module.js";
import { TABLETOP_RPG_PRODUCT_MODULE } from "./tabletop-rpg/product-module.js";

export const ACTIVE_PRODUCT_MODULES = Object.freeze([
  MURDER_MYSTERY_PRODUCT_MODULE,
  TABLETOP_RPG_PRODUCT_MODULE,
  BOARD_GAME_PRODUCT_MODULE
]);

const modulesByKey = Object.freeze(Object.fromEntries(
  ACTIVE_PRODUCT_MODULES.map((product) => [product.domain.key, product])
));

const legacyProductModule = Object.freeze({
  domain: LEGACY_INTERACTIVE_STORY_DOMAIN,
  viewModules: Object.freeze({}),
  shell: Object.freeze({
    brandSubtitle: "LEGACY PROJECT",
    authDescription: "登录后可管理旧项目数据。",
    showCreatorRuntimeControls: false,
    advancedNavigation: false,
    advancedSharedScopeLabel: "",
    summarizeWorld: () => "旧版项目 · 仅保留账号与导出入口"
  }),
  library: Object.freeze({
    catalogAvailable: false,
    catalogLabel: "",
    loadRoomCounts: false,
    hint: () => "旧版只读项目"
  }),
  runtime: Object.freeze({ label: "", activate() {} })
});

export function productModule(value) {
  const key = normalizeProductDomainType(value);
  return modulesByKey[key] || legacyProductModule;
}

export function productModuleForWorld(world = {}) {
  return productModule(narrativeProfileFromWorld(world).creationType);
}

export function productModuleFromShellMode(shellMode = "") {
  return ACTIVE_PRODUCT_MODULES.find((product) => product.domain.shellMode === shellMode) || null;
}

function collectProductViewModules() {
  const viewOwners = new Map();
  const modules = {};
  for (const product of ACTIVE_PRODUCT_MODULES) {
    for (const [view, loaders] of Object.entries(product.viewModules)) {
      const existingOwner = viewOwners.get(view);
      if (existingOwner) {
        throw new Error(`Product view "${view}" is owned by both ${existingOwner} and ${product.domain.key}`);
      }
      viewOwners.set(view, product.domain.key);
      modules[view] = loaders;
    }
  }
  return Object.freeze(modules);
}

export const PRODUCT_VIEW_MODULES = collectProductViewModules();
