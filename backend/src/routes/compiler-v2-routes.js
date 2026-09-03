// Compiler V2 — job-based import pipeline routes (staging → review → commit)

import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { throwErr } from "../api-errors.js";
import {
  createCompilerV2Job,
  getCompilerV2Status,
  getCompilerV2Results,
  commitCompilerV2Job
} from "../compiler-v2/job-service.js";
import {
  runCompilerV2Schema,
  compilerV2JobQuerySchema,
  commitCompilerV2Schema
} from "./schemas/compiler-v2.js";

export async function registerCompilerV2Routes(app) {
  app.post("/api/worlds/:worldId/compiler-v2/run", {
    schema: runCompilerV2Schema
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");

    const body = request.body || {};
    if (body.rightsConfirmed !== true) {
      throwErr("IMPORT_RIGHTS_CONFIRMATION_REQUIRED");
    }

    const result = await createCompilerV2Job(worldId, actorId, {
      creationType: body.creationType || "murder_mystery",
      inputFiles: {
        rightsConfirmed: body.rightsConfirmed,
        hostHandbook: body.hostHandbook,
        roleScripts: body.roleScripts || [],
        clueTextDoc: body.clueTextDoc,
        mechanismDoc: body.mechanismDoc,
        sceneDocs: body.sceneDocs || [],
        notes: body.notes
      }
    });
    return reply.code(202).send(result);
  });

  app.get("/api/worlds/:worldId/compiler-v2/status", {
    schema: compilerV2JobQuerySchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    return getCompilerV2Status(worldId, request.query.jobId);
  });

  app.get("/api/worlds/:worldId/compiler-v2/results", {
    schema: compilerV2JobQuerySchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    return getCompilerV2Results(worldId, request.query.jobId);
  });

  app.post("/api/worlds/:worldId/compiler-v2/commit", {
    schema: commitCompilerV2Schema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    return commitCompilerV2Job(worldId, request.body.jobId, {
      confirmCommit: request.body.confirmCommit
    });
  });
}
