import {
  importCreatorDocumentPages,
  importParsedCreatorDocument,
  parseFeishuDocumentForWorld,
  parseCreatorDocumentForWorld
} from "../creator-document-service.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import {
  importDocumentPagesSchema,
  importDocumentSchema,
  parseDocumentSchema,
  parseFeishuDocumentSchema
} from "./schemas/creator-document.js";

export async function registerCreatorDocumentRoutes(app) {
  app.post("/api/worlds/:worldId/documents/parse", { schema: parseDocumentSchema }, async (request) => {
    const actorId = requireActor(request);
    await requireWorldRole(actorId, request.params.worldId);
    return parseCreatorDocumentForWorld(request.body);
  });

  app.post("/api/worlds/:worldId/documents/feishu/parse", { schema: parseFeishuDocumentSchema }, async (request) => {
    const actorId = requireActor(request);
    await requireWorldRole(actorId, request.params.worldId, ["owner", "editor"]);
    return parseFeishuDocumentForWorld(request.body);
  });

  app.post("/api/worlds/:worldId/documents/import", { schema: importDocumentSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return importParsedCreatorDocument({ request, reply, actorId, worldId, payload: request.body });
  });

  app.post("/api/worlds/:worldId/documents/import-pages", { schema: importDocumentPagesSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return importCreatorDocumentPages({ request, reply, actorId, worldId, payload: request.body });
  });
}
