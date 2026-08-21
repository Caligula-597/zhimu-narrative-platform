import { createWorldProductPreHandler } from "../route-guards.js";

/**
 * Tabletop RPG product route boundary.
 *
 * The current tabletop workbench persists through the shared world-settings
 * write contract, so it has no dedicated HTTP endpoints yet. Keeping a scoped
 * plugin gives future map/runtime routes an isolated guarded owner instead of
 * adding them to murder-mystery or platform route modules.
 */
export async function registerTabletopRpgProductRoutes(app) {
  app.addHook("preHandler", createWorldProductPreHandler("tabletop_rpg"));
}
