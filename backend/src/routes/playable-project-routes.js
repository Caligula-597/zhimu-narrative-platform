import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import {
  loadPlayableProject,
  savePlayableProject,
  compileAndSaveWarehouseFixture,
} from "../playable-project-service.js";
import { runRevisionMutation } from "../world-revision.js";
import { requireWorldRole, WORLD_CREATOR_READER_ROLES } from "./route-guards.js";
import {
  getPlayableProjectSchema,
  putPlayableProjectSchema,
  postCompilePlayableFixtureSchema,
} from "./schemas/playable-project.js";

export async function registerPlayableProjectRoutes(app) {
  app.get(
    "/api/worlds/:worldId/playable-project",
    { schema: getPlayableProjectSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
      return loadPlayableProject(worldId);
    },
  );

  app.put(
    "/api/worlds/:worldId/playable-project",
    { schema: putPlayableProjectSchema },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      await requireWorldRole(actorId, worldId);
      const raw = request.body?.project;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return sendErr(reply, "PLAYABLE_PROJECT_REQUIRED", "project object is required");
      }
      try {
        return await runRevisionMutation(
          request,
          reply,
          worldId,
          (client) => savePlayableProject(client, worldId, raw, actorId),
          { sendErr },
        );
      } catch (error) {
        if (error?.code === "WORLD_NOT_FOUND") {
          return sendErr(reply, "WORLD_NOT_FOUND", "World not found");
        }
        throw error;
      }
    },
  );

  app.post(
    "/api/worlds/:worldId/playable-project/compile-fixture",
    { schema: postCompilePlayableFixtureSchema },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      await requireWorldRole(actorId, worldId);
      try {
        return await runRevisionMutation(
          request,
          reply,
          worldId,
          (client) => compileAndSaveWarehouseFixture(client, worldId, actorId),
          { sendErr },
        );
      } catch (error) {
        if (error?.code === "WORLD_NOT_FOUND") {
          return sendErr(reply, "WORLD_NOT_FOUND", "World not found");
        }
        throw error;
      }
    },
  );
}
