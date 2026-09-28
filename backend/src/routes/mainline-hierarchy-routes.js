import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { loadMainlineHierarchyDraft, saveMainlineHierarchyDraft } from "../mainline-hierarchy-service.js";
import { runRevisionMutation } from "../world-revision.js";
import { requireWorldRole, WORLD_CREATOR_READER_ROLES } from "./route-guards.js";
import { mainlineHierarchyDraftPutSchema } from "./schemas/mainline-hierarchy.js";

export async function registerMainlineHierarchyRoutes(app) {
  app.get("/api/worlds/:worldId/mainline-hierarchy", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
    return loadMainlineHierarchyDraft(worldId);
  });

  app.put("/api/worlds/:worldId/mainline-hierarchy", { schema: mainlineHierarchyDraftPutSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => saveMainlineHierarchyDraft(client, worldId, request.body.draft, actorId),
      { sendErr }
    );
  });
}
