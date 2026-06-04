import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { searchWorldContent } from "../world-search.js";
import { requireWorldRole } from "./route-guards.js";
import { worldSearchQuerySchema } from "./schemas.js";

export async function registerSearchRoutes(app) {
  app.get("/api/worlds/:worldId/search", { schema: worldSearchQuerySchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);

    const q = String(request.query?.q ?? "").trim();
    if (!q) return sendErr(reply, "BAD_REQUEST");

    const limit = request.query?.limit;
    const type = request.query?.type ?? "all";

    return searchWorldContent(worldId, { q, limit, type });
  });
}
