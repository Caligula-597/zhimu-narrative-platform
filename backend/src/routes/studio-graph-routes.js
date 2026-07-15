import { requireActor } from "../request-actor.js";
import { sendErr } from "../api-errors.js";
import { requireWorldRole, requireWorldReader } from "./route-guards.js";
import { runRevisionMutation } from "../world-revision.js";
import {
  autoLayoutStory,
  getStudioNodeReferences,
  removeStoryEdge,
  removeStudioNode,
  setStoryLayout,
  setStudioNodeAnchors,
  setStudioNodePosition
} from "../studio-graph-service.js";
import {
  studioNodeReferencesSchema,
  deleteStoryEdgeSchema,
  deleteStudioNodeSchema,
  updateNodePositionSchema,
  updateNodeAnchorsSchema,
  updateStoryLayoutSchema,
  autoStoryLayoutSchema
} from "./schemas.js";

export async function registerStudioGraphRoutes(app) {
  app.get("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId/references", { schema: studioNodeReferencesSchema }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, nodeType, nodeId } = request.params;
    await requireWorldReader(actorId, worldId);
    return getStudioNodeReferences(worldId, nodeType, nodeId);
  });

  app.delete("/api/worlds/:worldId/story-edges/:edgeId", { schema: deleteStoryEdgeSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, edgeId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => removeStoryEdge(client, worldId, edgeId),
      { sendErr }
    );
  });

  app.delete("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId", { schema: deleteStudioNodeSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, nodeType, nodeId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => removeStudioNode(client, worldId, nodeType, nodeId),
      { sendErr }
    );
  });

  app.put("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId/position", { schema: updateNodePositionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, nodeType, nodeId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => setStudioNodePosition(client, worldId, nodeType, nodeId, request.body ?? {}),
      { sendErr }
    );
  });

  app.put("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId/anchors", { schema: updateNodeAnchorsSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, nodeType, nodeId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => setStudioNodeAnchors(client, worldId, nodeType, nodeId, request.body?.anchors),
      { sendErr }
    );
  });

  app.put("/api/worlds/:worldId/story-layout", { schema: updateStoryLayoutSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => setStoryLayout(client, worldId, request.body?.positions),
      { sendErr }
    );
  });

  app.post("/api/worlds/:worldId/story-layout/auto", { schema: autoStoryLayoutSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => autoLayoutStory(client, worldId, request.body?.mode),
      { sendErr }
    );
  });
}
