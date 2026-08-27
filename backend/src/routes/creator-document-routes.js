import {
  importCreatorDocumentPages,
  importParsedCreatorDocument,
  parseFeishuDocumentForWorld,
  parseCreatorDocumentForWorld
} from "../creator-document-service.js";
import { commitOpeningPackage, previewOpeningPackage } from "../opening-package-service.js";
import { loadImportSource } from "../import-source-service.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole, WORLD_CREATOR_READER_ROLES } from "./route-guards.js";
import { DOCUMENT_JSON_BODY_LIMIT_BYTES } from "../document-parser.js";
import {
  importDocumentPagesSchema,
  importDocumentSchema,
  parseDocumentSchema,
  parseFeishuDocumentSchema
} from "./schemas/creator-document.js";
import {
  commitOpeningPackageSchema,
  previewOpeningPackageSchema
} from "./schemas/opening-package.js";
import { worldIdParams } from "./schemas.js";

export async function registerCreatorDocumentRoutes(app) {
  app.get("/api/worlds/:worldId/import-source", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
    return loadImportSource(worldId);
  });

  app.post("/api/worlds/:worldId/documents/parse", {
    schema: parseDocumentSchema,
    bodyLimit: DOCUMENT_JSON_BODY_LIMIT_BYTES
  }, async (request) => {
    const actorId = requireActor(request);
    await requireWorldRole(actorId, request.params.worldId);
    return parseCreatorDocumentForWorld(request.body);
  });

  app.post("/api/worlds/:worldId/documents/feishu/parse", { schema: parseFeishuDocumentSchema }, async (request) => {
    const actorId = requireActor(request);
    await requireWorldRole(actorId, request.params.worldId, ["owner", "editor"]);
    return parseFeishuDocumentForWorld(request.body);
  });

  app.post("/api/worlds/:worldId/documents/import", {
    schema: importDocumentSchema,
    bodyLimit: DOCUMENT_JSON_BODY_LIMIT_BYTES
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return importParsedCreatorDocument({ request, reply, actorId, worldId, payload: request.body });
  });

  app.post("/api/worlds/:worldId/documents/import-pages", {
    schema: importDocumentPagesSchema,
    bodyLimit: DOCUMENT_JSON_BODY_LIMIT_BYTES
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return importCreatorDocumentPages({ request, reply, actorId, worldId, payload: request.body });
  });

  app.post("/api/worlds/:worldId/opening-package/preview", {
    schema: previewOpeningPackageSchema,
    bodyLimit: DOCUMENT_JSON_BODY_LIMIT_BYTES
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return previewOpeningPackage(request.body);
  });

  app.post("/api/worlds/:worldId/opening-package/commit", {
    schema: commitOpeningPackageSchema,
    bodyLimit: DOCUMENT_JSON_BODY_LIMIT_BYTES
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return commitOpeningPackage({ request, reply, actorId, worldId, payload: request.body });
  });
}
