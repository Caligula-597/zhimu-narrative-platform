/** Backward-compatible schema barrel. New routes should import their domain schema module. */
export { paramsSchema } from "./schemas/primitives.js";
export * from "./schemas/player.js";
export * from "./schemas/world.js";
export * from "./schemas/creator.js";
export * from "./schemas/ai.js";
export * from "./schemas/platform.js";
export * from "./schemas/checkpoint.js";
export * from "./schemas/player-progress.js";
export * from "./schemas/host-content-action.js";
export * from "./schemas/studio-investigation.js";
export * from "./schemas/rules.js";
export * from "./schemas/recap.js";
export * from "./schemas/host-communication.js";
export * from "./schemas/host-player-management.js";
export * from "./schemas/content-platform-truth.js";
