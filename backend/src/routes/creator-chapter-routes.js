import { addCreatorChapter, reviseCreatorChapter } from "../creator-chapter-service.js";
import { requireActor } from "../request-actor.js";
import { createChapterSchema, updateChapterSchema } from "./schemas/creator-chapter.js";

export async function registerCreatorChapterRoutes(app) {
  app.post("/api/worlds/:worldId/chapters", { schema: createChapterSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    return addCreatorChapter({ request, reply, actorId, worldId, body: request.body });
  });

  app.put("/api/worlds/:worldId/chapters/:chapterId", { schema: updateChapterSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, chapterId } = request.params;
    return reviseCreatorChapter({ request, reply, actorId, worldId, chapterId, body: request.body });
  });
}
