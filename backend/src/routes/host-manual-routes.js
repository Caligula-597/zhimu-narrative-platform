// Host Manual Compiler — REST routes (缺口6)

import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import {
  getLatestManual,
  getManual,
  listManualVersions,
  compileManual,
  updateSection,
  addSection,
  deleteSection
} from "../host-manual-compiler-service.js";
import {
  getLatestSchema,
  getVersionSchema,
  listVersionsSchema,
  compileSchema,
  updateSectionSchema,
  addSectionSchema,
  deleteSectionSchema
} from "./schemas/host-manual.js";

async function requireEditor(request) {
  const actorId = requireActor(request);
  const { worldId } = request.params;
  await requireWorldRole(actorId, worldId, "editor");
  return worldId;
}

export async function registerHostManualRoutes(app) {
  app.get("/api/worlds/:worldId/host-manual", {
    schema: getLatestSchema
  }, async (request) => {
    const worldId = await requireEditor(request);
    return getLatestManual(worldId);
  });

  app.get("/api/worlds/:worldId/host-manual/versions", {
    schema: listVersionsSchema
  }, async (request) => {
    const worldId = await requireEditor(request);
    return listManualVersions(worldId);
  });

  app.get("/api/worlds/:worldId/host-manual/versions/:version", {
    schema: getVersionSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const manual = await getManual(worldId, request.params.version);
    if (!manual) return sendErr(reply, "NOT_FOUND", "Host manual version not found");
    return manual;
  });

  app.post("/api/worlds/:worldId/host-manual/compile", {
    schema: compileSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const manual = await compileManual(worldId);
    return reply.code(201).send(manual);
  });

  app.patch("/api/worlds/:worldId/host-manual/sections/:sectionId", {
    schema: updateSectionSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const section = await updateSection(worldId, request.params.sectionId, request.body);
    if (!section) return sendErr(reply, "MANUAL_SECTION_NOT_FOUND", "Host manual section not found");
    return section;
  });

  app.post("/api/worlds/:worldId/host-manual/sections", {
    schema: addSectionSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const section = await addSection(worldId, request.body);
    return reply.code(201).send(section);
  });

  app.delete("/api/worlds/:worldId/host-manual/sections/:sectionId", {
    schema: deleteSectionSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    try {
      return await deleteSection(worldId, request.params.sectionId);
    } catch (error) {
      if (error?.code === "MANUAL_SECTION_NOT_FOUND") {
        return sendErr(reply, "MANUAL_SECTION_NOT_FOUND", "Host manual section not found");
      }
      throw error;
    }
  });
}