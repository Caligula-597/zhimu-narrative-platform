import { BOARD_GAME_DOMAIN } from "./board-game.js";
import { LEGACY_INTERACTIVE_STORY_DOMAIN } from "./legacy-interactive-story.js";
import { MURDER_MYSTERY_DOMAIN } from "./murder-mystery.js";
import { TABLETOP_RPG_DOMAIN } from "./tabletop-rpg.js";

export const ACTIVE_PRODUCT_TYPES = Object.freeze(["murder_mystery", "tabletop_rpg", "board_game"]);
export const PRODUCT_DOMAIN_TYPES = Object.freeze([...ACTIVE_PRODUCT_TYPES, "interactive_story"]);

export const PRODUCT_DOMAINS = Object.freeze({
  murder_mystery: MURDER_MYSTERY_DOMAIN,
  tabletop_rpg: TABLETOP_RPG_DOMAIN,
  board_game: BOARD_GAME_DOMAIN,
  interactive_story: LEGACY_INTERACTIVE_STORY_DOMAIN
});

export function normalizeProductDomainType(value, fallback = "murder_mystery") {
  const key = String(value ?? "").trim().toLowerCase();
  return PRODUCT_DOMAIN_TYPES.includes(key) ? key : fallback;
}

export function productDomainDefinition(value) {
  return PRODUCT_DOMAINS[normalizeProductDomainType(value)];
}

export function isActiveProductType(value) {
  return ACTIVE_PRODUCT_TYPES.includes(String(value ?? "").trim().toLowerCase());
}
