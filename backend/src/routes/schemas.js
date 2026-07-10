/** Backward-compatible schema barrel. New routes should import their domain schema module. */
export { paramsSchema } from "./schemas/primitives.js";
export * from "./schemas/player.js";
export * from "./schemas/world.js";
export * from "./schemas/creator.js";
export * from "./schemas/ai.js";
export * from "./schemas/platform.js";
