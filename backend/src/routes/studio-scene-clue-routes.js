import { requireActor } from "../request-actor.js";
import {
  addStudioClue,
  addStudioScene,
  bindStudioCluePaths,
  reviseStudioClue,
  reviseStudioScene
} from "../studio-scene-clue-service.js";
import { loadClueEditImpact, loadSceneEditImpact } from "../module-edit-impact-service.js";
import { requireWorldRole, WORLD_CREATOR_READER_ROLES } from "./route-guards.js";
import {
  bindCluePathsSchema,
  createClueSchema,
  createSceneSchema,
  patchClueSchema,
  patchSceneSchema
} from "./schemas/studio-scene-clue.js";
import { worldIdParams } from "./schemas.js";

export async function registerStudioSceneClueRoutes(app) {
  app.get("/api/worlds/:worldId/clues/:clueId/edit-impact", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        properties: {
          worldId: worldIdParams.properties.worldId,
          clueId: { type: "string", format: "uuid" }
        },
        required: ["worldId", "clueId"]
      }
    }
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, clueId } = request.params;
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
    return loadClueEditImpact(worldId, clueId);
  });

  app.get("/api/worlds/:worldId/scenes/:sceneId/edit-impact", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        properties: {
          worldId: worldIdParams.properties.worldId,
          sceneId: { type: "string", format: "uuid" }
        },
        required: ["worldId", "sceneId"]
      }
    }
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, sceneId } = request.params;
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
    return loadSceneEditImpact(worldId, sceneId);
  });

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

  app.post("/api/worlds/:worldId/clues/bind-paths", { schema: bindCluePathsSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return bindStudioCluePaths({ request, reply, actorId, worldId, body: request.body ?? {} });
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
