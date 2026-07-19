import { requireActor } from "../request-actor.js";
import {
  addStudioClue,
  addStudioScene,
  reviseStudioClue,
  reviseStudioScene
} from "../studio-scene-clue-service.js";
import { requireWorldRole } from "./route-guards.js";
import { createClueSchema, createSceneSchema, patchClueSchema, patchSceneSchema } from "./schemas/studio-scene-clue.js";

export async function registerStudioSceneClueRoutes(app) {
  app.post("/api/worlds/:worldId/scenes", { schema: createSceneSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return addStudioScene({ request, reply, actorId, worldId, body: request.body ?? {} });
  });

  app.post("/api/worlds/:worldId/clues", { schema: createClueSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return addStudioClue({ request, reply, actorId, worldId, body: request.body ?? {} });
  });

  app.patch("/api/worlds/:worldId/scenes/:sceneId", { schema: patchSceneSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, sceneId } = request.params;
    await requireWorldRole(actorId, worldId);
    return reviseStudioScene({ request, reply, actorId, worldId, sceneId, body: request.body ?? {} });
  });

  app.patch("/api/worlds/:worldId/clues/:clueId", { schema: patchClueSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, clueId } = request.params;
    await requireWorldRole(actorId, worldId);
    return reviseStudioClue({ request, reply, actorId, worldId, clueId, body: request.body ?? {} });
  });
}
