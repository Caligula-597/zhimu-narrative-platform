import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import {
  loadStoryManuscript,
  saveStoryManuscript,
  syncStoryManuscriptFromGraph,
  syncStoryManuscriptToGraph
} from "../story-manuscript-service.js";
import { runRevisionMutation } from "../world-revision.js";
import { requireWorldRole, WORLD_CREATOR_READER_ROLES } from "./route-guards.js";
import {
  storyManuscriptPutSchema,
  storyManuscriptSyncFromGraphSchema,
  storyManuscriptSyncToGraphSchema
} from "./schemas.js";

export async function registerStoryManuscriptRoutes(app) {
  app.get("/api/worlds/:worldId/story-manuscript", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
    return loadStoryManuscript(worldId);
  });

  app.put("/api/worlds/:worldId/story-manuscript", { schema: storyManuscriptPutSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = String(request.body?.body ?? "").trim();
    if (!body) return sendErr(reply, "STORY_MANUSCRIPT_REQUIRED");
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => saveStoryManuscript(client, worldId, body, actorId),
      { sendErr }
    );
  });

  app.post("/api/worlds/:worldId/story-manuscript/sync-from-graph", { schema: storyManuscriptSyncFromGraphSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => syncStoryManuscriptFromGraph(client, worldId, actorId),
      { sendErr }
    );
  });

  app.post("/api/worlds/:worldId/story-manuscript/sync-to-graph", { schema: storyManuscriptSyncToGraphSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = String(request.body?.body ?? "").trim();
    if (!body) return sendErr(reply, "STORY_MANUSCRIPT_REQUIRED");
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => syncStoryManuscriptToGraph(client, worldId, body, actorId),
      { sendErr, statusCode: 201 }
    );
  });
}
