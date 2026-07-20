import {
  addCreatorSection,
  removeCreatorSection,
  reviseCreatorSection
} from "../creator-section-service.js";
import { requireActor } from "../request-actor.js";
import { createSectionSchema, deleteSectionSchema, updateSectionSchema } from "./schemas/creator-section.js";

export async function registerCreatorSectionRoutes(app) {
  app.post("/api/worlds/:worldId/roles/:roleSlotId/sections", { schema: createSectionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    return addCreatorSection({ request, reply, actorId, worldId, roleSlotId, body: request.body ?? {} });
  });

  app.put("/api/worlds/:worldId/roles/:roleSlotId/sections/:sectionId", { schema: updateSectionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId, sectionId } = request.params;
    return reviseCreatorSection({
      request, reply, actorId, worldId, roleSlotId, sectionId, body: request.body ?? {}
    });
  });

  app.delete("/api/worlds/:worldId/roles/:roleSlotId/sections/:sectionId", { schema: deleteSectionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId, sectionId } = request.params;
    return removeCreatorSection({ request, reply, actorId, worldId, roleSlotId, sectionId });
  });
}
