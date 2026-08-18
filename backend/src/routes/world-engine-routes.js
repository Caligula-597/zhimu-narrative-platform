import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { createLlmContextPreHandler } from "./llm-route-hook.js";
import { runRevisionMutation } from "../world-revision.js";
import {
  worldEngineCommitSchema,
  worldEngineEpistemicCommitSchema,
  worldEngineGetSchema,
  worldEngineLowerTypeSchema,
  worldEngineRepairSchema,
  worldEngineRenderSchema,
  worldEngineSearchSchema,
  worldEngineSeedSchema
} from "./schemas/world-engine.js";
import {
  commitWorldEngineEpistemic,
  commitWorldEngineEvents,
  generateWorldEngineScript,
  loadWorldEngine,
  lowerWorldEngineType,
  repairWorldEngineScript,
  searchWorldEngineEpistemic,
  searchWorldEngineEvents,
  seedWorldEngine,
  storeWorldEngineCandidates,
  storeWorldEngineEpistemic,
  storeWorldEngineScript
} from "../world-engine-service.js";

const llmPreHandler = createLlmContextPreHandler(sendErr);

export async function registerWorldEngineRoutes(app) {
  app.get("/api/worlds/:worldId/world-engine", { schema: worldEngineGetSchema }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const loaded = await loadWorldEngine(worldId);
    return loaded.view;
  });

  app.put("/api/worlds/:worldId/world-engine/seed", { schema: worldEngineSeedSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(request, reply, worldId, (client) => seedWorldEngine(client, worldId, request.body ?? {}), { sendErr });
  });

  app.post(
    "/api/worlds/:worldId/world-engine/search",
    { schema: worldEngineSearchSchema, preHandler: llmPreHandler },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      await requireWorldRole(actorId, worldId);
      const searched = await searchWorldEngineEvents(worldId);
      return runRevisionMutation(
        request,
        reply,
        worldId,
        (client) => storeWorldEngineCandidates(client, worldId, searched),
        { sendErr }
      );
    }
  );

  app.post("/api/worlds/:worldId/world-engine/commit", { schema: worldEngineCommitSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => commitWorldEngineEvents(client, worldId, request.body?.candidateIds || [], request.body?.event || null),
      { sendErr }
    );
  });

  app.post("/api/worlds/:worldId/world-engine/lower-type", { schema: worldEngineLowerTypeSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => lowerWorldEngineType(client, worldId, request.body?.actionType),
      { sendErr }
    );
  });

  app.post(
    "/api/worlds/:worldId/world-engine/epistemic/search",
    { schema: worldEngineSearchSchema, preHandler: llmPreHandler },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      await requireWorldRole(actorId, worldId);
      const searched = await searchWorldEngineEpistemic(worldId);
      return runRevisionMutation(
        request,
        reply,
        worldId,
        (client) => storeWorldEngineEpistemic(client, worldId, searched),
        { sendErr }
      );
    }
  );

  app.post("/api/worlds/:worldId/world-engine/epistemic/commit", { schema: worldEngineEpistemicCommitSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => commitWorldEngineEpistemic(client, worldId, request.body?.indexes || []),
      { sendErr }
    );
  });

  app.post(
    "/api/worlds/:worldId/world-engine/render",
    { schema: worldEngineRenderSchema, preHandler: llmPreHandler },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      await requireWorldRole(actorId, worldId);
      const generated = await generateWorldEngineScript(worldId, request.body?.characterId, request.body?.actId || "ACT_1");
      return runRevisionMutation(
        request,
        reply,
        worldId,
        (client) => storeWorldEngineScript(client, worldId, generated),
        { sendErr }
      );
    }
  );

  app.post("/api/worlds/:worldId/world-engine/repair", { schema: worldEngineRepairSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => repairWorldEngineScript(
        client,
        worldId,
        request.body?.characterId,
        request.body?.actId || "ACT_1",
        request.body?.text
      ),
      { sendErr }
    );
  });
}
